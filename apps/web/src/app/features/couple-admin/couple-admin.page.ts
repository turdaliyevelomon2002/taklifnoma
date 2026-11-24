import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CoupleSessionInfo } from '@taklifnoma/shared';
import { LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { errorKey, toApiError } from '../../core/api/api-error';
import { CoupleApi } from '../../core/api/couple-api.service';
import { isLocale, LangService } from '../../core/i18n/lang.service';
import { localize } from '../../core/i18n/localize.pipe';
import { EventDatePipe } from '../../shared/date/event-date.pipe';
import { GuestListComponent } from '../../shared/guests/guest-list/guest-list.component';
import { PinLoginComponent } from './pin-login.component';

const LANG_KEY = 'tk-admin-lang';

type View = 'checking' | 'login' | 'ready';

/**
 * /{slug}/admin: juftlik paneli. Faqat brauzerda render qilinadi (RenderMode.Client).
 *
 * Kirish: maxfiy havola (#k=<token>; fragment serverga yuborilmaydi va loglarga tushmaydi)
 * yoki 6 xonali PIN. Sessiya httpOnly cookie'da.
 */
@Component({
  selector: 'tk-couple-admin-page',
  imports: [TranslocoPipe, EventDatePipe, PinLoginComponent, GuestListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './couple-admin.page.html',
  styleUrl: './couple-admin.page.scss',
})
export class CoupleAdminPage {
  /** Route parametri (withComponentInputBinding). */
  readonly slug = input.required<string>();

  protected readonly api = inject(CoupleApi);
  private readonly i18n = inject(LangService);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  protected readonly lang = this.i18n.lang;
  protected readonly locales = LOCALES;
  protected readonly view = signal<View>('checking');
  protected readonly session = signal<CoupleSessionInfo | null>(null);
  /** Kirish sahifasida ko'rsatiladigan xato kaliti (masalan, havola eskirgan). */
  protected readonly loginError = signal<string | null>(null);
  protected readonly refreshing = signal(false);

  protected readonly names = computed(() => {
    const s = this.session();
    if (!s) return '';
    const l = this.lang();
    const groom = localize(s.couple.groom.firstName, l);
    const bride = localize(s.couple.bride.firstName, l);
    return s.couple.order === 'bride-first' ? `${bride} & ${groom}` : `${groom} & ${bride}`;
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    await this.restoreLang();
    this.title.setTitle(this.i18n.translate('admin.title'));

    const token = this.takeTokenFromHash();
    if (token) {
      try {
        await this.api.loginWithToken(this.slug(), token);
      } catch (err) {
        this.loginError.set(errorKey(toApiError(err).code));
      }
    }
    await this.loadSession();
  }

  /** #k=... ni o'qiydi va darhol manzildan o'chiradi (tarixda va ekranda qolmasin). */
  private takeTokenFromHash(): string | null {
    const loc = this.document.location;
    const token = new URLSearchParams(loc.hash.slice(1)).get('k');
    if (token) history.replaceState(history.state, '', loc.pathname + loc.search);
    return token;
  }

  private async loadSession(): Promise<void> {
    try {
      const me = await this.api.me();
      if (me.slug !== this.slug()) {
        // Boshqa taklifnomaning sessiyasi: aralashtirmaslik uchun chiqib, qayta kirishni so'raymiz.
        await this.api.logout().catch(() => undefined);
        this.view.set('login');
        return;
      }
      this.session.set(me);
      this.view.set('ready');
    } catch (err) {
      const e = toApiError(err);
      if (e.status !== 401) this.loginError.set(errorKey(e.code));
      this.session.set(null);
      this.view.set('login');
    }
  }

  protected async onLoggedIn(): Promise<void> {
    this.loginError.set(null);
    await this.loadSession();
  }

  /** Statistikani yangilash (masalan, javob o'chirilgandan keyin). */
  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      this.session.set(await this.api.me());
    } catch (err) {
      if (toApiError(err).status === 401) this.view.set('login');
    } finally {
      this.refreshing.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.api.logout().catch(() => undefined);
    this.session.set(null);
    this.view.set('login');
  }

  protected async setLang(lang: Locale): Promise<void> {
    await this.i18n.use(lang);
    this.title.setTitle(this.i18n.translate('admin.title'));
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* saqlanmasa ham bo'ladi */
    }
  }

  private async restoreLang(): Promise<void> {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch {
      /* localStorage yo'q */
    }
    const fromUrl = new URLSearchParams(this.document.location.search).get('lang');
    const lang = [fromUrl, saved].find(isLocale);
    if (lang && lang !== this.lang()) await this.i18n.use(lang);
  }
}
