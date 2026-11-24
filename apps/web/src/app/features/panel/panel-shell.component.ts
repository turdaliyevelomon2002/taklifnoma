import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TelegramLinkInfo } from '@taklifnoma/shared';
import { LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { OwnerApi } from '../../core/api/owner-api.service';
import { isLocale, LangService } from '../../core/i18n/lang.service';
import { OwnerSession } from './owner-session.service';

const LANG_KEY = 'tk-panel-lang';

/** /panel: yuqori menyu + sahifalar. Faqat brauzerda render qilinadi. */
@Component({
  selector: 'tk-panel-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel.scss',
  template: `
    <div class="panel">
      @if (session.profile(); as me) {
        <header class="topbar">
          <div class="topbar__inner">
            <a class="topbar__brand" routerLink="/panel">Taklifnoma · {{ 'panel.title' | transloco }}</a>
            <nav class="topbar__nav">
              <a routerLink="/panel" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
                {{ 'panel.nav.orders' | transloco }}
              </a>
              <a routerLink="/panel/new" routerLinkActive="is-active" class="topbar__new">+ {{ 'panel.nav.new' | transloco }}</a>
            </nav>
            <div class="topbar__right">
              @if (telegram(); as tg) {
                @if (!tg.linked && tg.url) {
                  <a class="topbar__tg" [href]="tg.url" target="_blank" rel="noopener">{{ 'panel.nav.connectTelegram' | transloco }}</a>
                }
              }
              <button type="button" class="topbar__lang" (click)="toggleLang()">{{ otherLang().toUpperCase() }}</button>
              <button type="button" class="topbar__logout" (click)="logout()" [attr.title]="me.email">
                {{ 'panel.nav.logout' | transloco }}
              </button>
            </div>
          </div>
        </header>
      }
      <router-outlet />
    </div>
  `,
  styles: `
    .topbar { position: sticky; top: 0; z-index: 20; background: #1f1d1a; color: #fff; }
    .topbar__inner {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;
      max-width: 1080px; margin: 0 auto; padding: 0.55rem 1rem;
    }
    .topbar__brand { color: #fff; font-weight: 700; text-decoration: none; margin-right: auto; }
    .topbar__nav { display: flex; gap: 0.25rem; order: 3; width: 100%; }
    .topbar__nav a {
      padding: 0.35rem 0.75rem; border-radius: 999px; color: #d8d3ca;
      text-decoration: none; font-size: 0.875rem; font-weight: 600;
    }
    .topbar__nav a.is-active { background: rgb(255 255 255 / 0.12); color: #fff; }
    .topbar__new { color: #f1d48e !important; }
    .topbar__right { display: flex; align-items: center; gap: 0.5rem; }
    .topbar__tg {
      padding: 0.3rem 0.7rem; border-radius: 999px; background: #2aabee;
      color: #fff; font-size: 0.78rem; font-weight: 700; text-decoration: none;
    }
    .topbar__lang, .topbar__logout {
      min-height: 2rem; padding: 0.25rem 0.7rem; border: 1px solid rgb(255 255 255 / 0.25);
      border-radius: 999px; background: transparent; color: #fff; font-size: 0.8rem; cursor: pointer;
    }
    @media (min-width: 720px) {
      .topbar__brand { margin-right: 0.5rem; }
      .topbar__nav { order: 0; width: auto; margin-right: auto; }
    }
  `,
})
export class PanelShellComponent {
  protected readonly session = inject(OwnerSession);
  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly i18n = inject(LangService);
  private readonly title = inject(Title);

  protected readonly telegram = signal<TelegramLinkInfo | null>(null);
  protected readonly otherLang = () => LOCALES.find((l) => l !== this.i18n.lang()) ?? 'uz';

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => void this.restoreLang());
    effect(() => {
      this.i18n.lang();
      this.title.setTitle(`${this.i18n.translate('panel.title')} · Taklifnoma`);
    });
    // Kirgandan keyin owner Telegram holatini bir marta olamiz.
    effect(() => {
      if (this.session.profile() && !this.telegram()) {
        this.api.telegram().then((t) => this.telegram.set(t), () => undefined);
      }
    });
  }

  protected async toggleLang(): Promise<void> {
    const next = this.otherLang() as Locale;
    await this.i18n.use(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* saqlanmasa ham bo'ladi */
    }
  }

  private async restoreLang(): Promise<void> {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved) && saved !== this.i18n.lang()) await this.i18n.use(saved);
    } catch {
      /* localStorage yo'q */
    }
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    this.telegram.set(null);
    await this.router.navigateByUrl('/panel/login');
  }
}
