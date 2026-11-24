import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale } from '@taklifnoma/shared/enums';
import { LangService } from '../../../core/i18n/lang.service';

/**
 * Til almashtirgich. Tanlangan til URL'ga (?lang=ru) yoziladi: havola ulashilganda
 * yoki sahifa yangilanganda til saqlanadi, SSR ham shu tilda render qiladi.
 */
@Component({
  selector: 'tk-lang-switch',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="switch" role="group" [attr.aria-label]="'invitation.lang.label' | transloco">
      @for (l of locales(); track l) {
        <button
          type="button"
          class="switch__btn"
          [class.switch__btn--active]="l === i18n.lang()"
          [attr.aria-pressed]="l === i18n.lang()"
          [attr.lang]="l"
          [attr.title]="'invitation.lang.' + l | transloco"
          (click)="select(l)"
        >
          {{ l.toUpperCase() }}
        </button>
      }
    </div>
  `,
  styles: `
    /* absolute: sahifa boshida turadi, aylantirganda sarlavhalar ustiga chiqmaydi.
       z-index intro (80) dan yuqori: til kirish ekranida ham tanlanadi. */
    .switch {
      position: absolute;
      top: max(0.75rem, env(safe-area-inset-top));
      right: max(0.75rem, env(safe-area-inset-right));
      z-index: 90;
      display: flex;
      padding: 0.2rem;
      border: 1px solid var(--tk-border);
      border-radius: 999px;
      background: color-mix(in srgb, var(--tk-surface) 85%, transparent);
      backdrop-filter: blur(6px);
    }
    .switch__btn {
      min-width: 2.5rem;
      padding: 0.35rem 0.6rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--tk-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      cursor: pointer;
    }
    .switch__btn--active { background: var(--tk-primary); color: var(--tk-primary-contrast); }
  `,
})
export class LangSwitchComponent {
  readonly locales = input.required<readonly Locale[]>();

  protected readonly i18n = inject(LangService);
  private readonly location = inject(Location);

  protected async select(lang: Locale): Promise<void> {
    if (lang === this.i18n.lang()) return;
    await this.i18n.use(lang);
    const [path] = this.location.path().split('?');
    this.location.replaceState(path ?? '', `lang=${lang}`);
  }
}
