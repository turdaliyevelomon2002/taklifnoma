import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CoupleAccessCredentials } from '@taklifnoma/shared';

/**
 * Juftlik panelining havolasi va PIN kodi. Server ularni faqat bir marta qaytaradi
 * (bazada faqat xeshi saqlanadi), shuning uchun owner hozir nusxa olishi kerak.
 */
@Component({
  selector: 'tk-credentials-card',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = credentials();
    <section class="creds" role="status">
      <h2 class="creds__title">🔑 {{ 'panel.access.newTitle' | transloco }}</h2>
      <p class="creds__warn">{{ 'panel.access.onceWarning' | transloco }}</p>

      <div class="creds__row">
        <span class="creds__label">{{ 'panel.access.link' | transloco }}</span>
        <code class="creds__value">{{ c.adminUrl }}</code>
        <button type="button" class="btn" (click)="copy('link', c.adminUrl)">
          {{ (copied() === 'link' ? 'panel.access.copied' : 'panel.access.copy') | transloco }}
        </button>
      </div>
      <div class="creds__row">
        <span class="creds__label">{{ 'panel.access.pin' | transloco }}</span>
        <code class="creds__value creds__pin">{{ c.pin }}</code>
        <button type="button" class="btn" (click)="copy('pin', c.pin)">
          {{ (copied() === 'pin' ? 'panel.access.copied' : 'panel.access.copy') | transloco }}
        </button>
      </div>
      <button type="button" class="btn btn--ghost creds__all" (click)="copy('all', message())">
        {{ (copied() === 'all' ? 'panel.access.copied' : 'panel.access.copyMessage') | transloco }}
      </button>
    </section>
  `,
  styles: `
    .creds {
      padding: 1rem; border: 2px solid var(--tk-accent); border-radius: var(--tk-radius);
      background: #fffaf0;
    }
    .creds__title { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .creds__warn { margin: 0 0 0.9rem; font-size: 0.85rem; color: #8a5a00; }
    .creds__row {
      display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 0.5rem; align-items: center;
      margin-bottom: 0.6rem;
    }
    .creds__label { grid-column: 1 / -1; font-size: 0.78rem; font-weight: 600; color: var(--tk-muted); }
    .creds__value {
      padding: 0.45rem 0.6rem; border-radius: 6px; background: #fff; border: 1px solid var(--tk-border);
      font-size: 0.82rem; overflow-wrap: anywhere; user-select: all;
    }
    .creds__pin { font-size: 1.25rem; letter-spacing: 0.3em; font-weight: 700; }
    .creds__all { width: 100%; margin-top: 0.25rem; }
  `,
})
export class CredentialsCardComponent {
  readonly credentials = input.required<CoupleAccessCredentials>();
  /** Juftlikka yuboriladigan tayyor matn (i18n'dan). */
  readonly messageText = input.required<string>();

  protected readonly copied = signal<'link' | 'pin' | 'all' | null>(null);

  protected message(): string {
    return this.messageText();
  }

  protected async copy(what: 'link' | 'pin' | 'all', text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(what);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      /* clipboard ruxsati yo'q: matn baribir belgilab olinadigan (user-select: all) */
    }
  }
}
