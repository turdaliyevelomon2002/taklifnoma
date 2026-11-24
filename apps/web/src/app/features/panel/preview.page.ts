import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
  type Type,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PublicInvitation } from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';
import { LangService } from '../../core/i18n/lang.service';
import { SeoService } from '../../core/seo/seo.service';
import { MusicPlayer } from '../invitation/music-player.service';
import { getTemplate } from '../invitation/templates/registry';
import type { InvitationTemplateBase } from '../invitation/templates/template-base';
import { WishesStore } from '../invitation/wishes.store';

/**
 * Qoralama (yoki istalgan holatdagi) taklifnomani mehmon ko'rinishida ko'rsatadi.
 * Ma'lumot owner API'sidan olinadi, shuning uchun nashr qilinmagan bo'lsa ham ishlaydi.
 */
@Component({
  selector: 'tk-panel-preview',
  imports: [NgComponentOutlet, TranslocoPipe],
  providers: [MusicPlayer, WishesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="status">👁 {{ 'panel.preview.banner' | transloco }}</div>
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

  protected readonly view = signal<{
    invitation: PublicInvitation;
    component: Type<InvitationTemplateBase>;
  } | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const invitation = await this.api.preview(id);
      const template = getTemplate(invitation.templateKey);
      const [component] = await Promise.all([template.load(), this.i18n.use(invitation.config.defaultLocale)]);
      for (const href of template.fonts) this.seo.ensureStylesheet(href);
      this.view.set({ invitation, component });
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    }
  }
}
