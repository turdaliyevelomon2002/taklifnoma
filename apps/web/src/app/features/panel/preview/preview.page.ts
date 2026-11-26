import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  type Type,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PublicInvitation } from '@taklifnoma/shared';
import { LOCALES, TEMPLATE_KEYS } from '@taklifnoma/shared/enums';
import { errorKey, toApiError } from '../../../core/api/api-error';
import { OwnerApi } from '../../../core/api/owner-api.service';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { MusicPlayer } from '../../invitation/music-player.service';
import { getTemplate } from '../../invitation/templates/registry';
import { SKIP_INTRO, type InvitationTemplateBase } from '../../invitation/templates/template-base';
import { WishesStore } from '../../invitation/wishes.store';
import { isPreviewMessage, type PreviewReady, type PreviewUpdate } from './preview-protocol';

function isEmbed(): boolean {
  return inject(ActivatedRoute).snapshot.queryParamMap.get('embed') === '1';
}

/**
 * Qoralama (yoki istalgan holatdagi) taklifnomani mehmon ko'rinishida ko'rsatadi.
 * Ma'lumot owner API'sidan olinadi, shuning uchun nashr qilinmagan bo'lsa ham ishlaydi.
 *
 * `?embed=1`: muharrirdagi jonli preview (iframe). Saqlanmagan o'zgarishlar ota oynadan
 * postMessage orqali keladi; intro va banner ko'rsatilmaydi.
 */
@Component({
  selector: 'tk-panel-preview',
  imports: [NgComponentOutlet, TranslocoPipe],
  providers: [MusicPlayer, WishesStore, { provide: SKIP_INTRO, useFactory: isEmbed }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!embed) {
      <div class="banner" role="status">👁 {{ 'panel.preview.banner' | transloco }}</div>
    }
    @if (view(); as v) {
      <ng-container *ngComponentOutlet="v.component; inputs: { invitation: v.invitation }" />
    } @else if (error(); as key) {
      <p class="error">{{ key | transloco }}</p>
    } @else {
      <p class="loading">{{ 'admin.loading' | transloco }}</p>
    }
  `,
  styles: `
    .banner {
      position: sticky; top: 0; z-index: 100; padding: 0.4rem 1rem;
      background: #1f1d1a; color: #f1d48e; font-size: 0.8rem; font-weight: 600; text-align: center;
    }
    .loading, .error { padding: 30vh 1rem; text-align: center; color: var(--tk-muted); }
  `,
})
export class PanelPreviewPage {
  readonly id = input.required<string>();

  private readonly api = inject(OwnerApi);
  private readonly i18n = inject(LangService);
  private readonly seo = inject(SeoService);
  protected readonly embed = isEmbed();

  protected readonly view = signal<{
    invitation: PublicInvitation;
    component: Type<InvitationTemplateBase>;
  } | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Shablon almashganda eski yuklash natijasi yangisini bosib ketmasin. */
  private loadSeq = 0;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });

    if (this.embed) {
      // Telefon ramkasi ichida: scrollbar joy egallamasin, dekorlar gorizontal scroll bermasin.
      const root = document.documentElement;
      root.style.scrollbarWidth = 'none';
      root.style.overflowX = 'hidden';
      document.body.style.overflowX = 'hidden';
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== location.origin || e.source !== window.parent) return;
        if (isPreviewMessage<PreviewUpdate>(e.data, 'tk-preview:update')) void this.apply(e.data);
      };
      window.addEventListener('message', onMessage);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('message', onMessage));
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const invitation = await this.api.preview(id);
      const component = await this.loadTemplate(invitation.templateKey);
      await this.i18n.use(invitation.config.defaultLocale);
      this.view.set({ invitation, component });
      if (this.embed) window.parent.postMessage({ type: 'tk-preview:ready' } satisfies PreviewReady, location.origin);
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    }
  }

  private async loadTemplate(key: PublicInvitation['templateKey']): Promise<Type<InvitationTemplateBase>> {
    const template = getTemplate(key);
    const component = await template.load();
    for (const href of template.fonts) this.seo.ensureStylesheet(href);
    return component;
  }

  /** Saqlanmagan qiymatlarni serverdan kelgan (media, slug) ustiga qo'yamiz. */
  private async apply(msg: PreviewUpdate): Promise<void> {
    const current = this.view();
    if (!current || !TEMPLATE_KEYS.includes(msg.templateKey) || !LOCALES.includes(msg.locale)) return;
    const seq = ++this.loadSeq;
    const component =
      msg.templateKey === current.invitation.templateKey ? current.component : await this.loadTemplate(msg.templateKey);
    if (seq !== this.loadSeq) return;
    if (this.i18n.lang() !== msg.locale) await this.i18n.use(msg.locale);
    this.view.set({
      component,
      invitation: { ...current.invitation, templateKey: msg.templateKey, config: msg.config, features: msg.features },
    });
  }
}
