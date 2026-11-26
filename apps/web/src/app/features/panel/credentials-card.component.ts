import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './ui/icon.component';
import type { CoupleAccessCredentials } from '@taklifnoma/shared';

/**
 * Juftlik panelining havolasi va PIN kodi. Server ularni faqat bir marta qaytaradi
 * (bazada faqat xeshi saqlanadi), shuning uchun owner hozir nusxa olishi kerak.
 */
@Component({
  selector: 'tk-credentials-card',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = credentials();
    <section class="creds" role="status">
      <div class="creds__head">
        <span class="creds__icon"><tk-icon name="lock" /></span>
        <div>
          <h2 class="creds__title">{{ 'panel.access.newTitle' | transloco }}</h2>
          <p class="creds__warn">{{ 'panel.access.onceWarning' | transloco }}</p>
        </div>
      </div>

      <span class="creds__label">{{ 'panel.access.link' | transloco }}</span>
      <div class="creds__row">
        <code class="creds__value">{{ c.adminUrl }}</code>
        <button type="button" class="btn btn--outline btn--sm" (click)="copy('link', c.adminUrl)">
          <tk-icon [name]="copied() === 'link' ? 'check' : 'copy'" />
          {{ (copied() === 'link' ? 'panel.access.copied' : 'panel.access.copy') | transloco }}
        </button>
      </div>
      <span class="creds__label">{{ 'panel.access.pin' | transloco }}</span>
      <div class="creds__row">
        <code class="creds__value creds__pin">{{ c.pin }}</code>
        <button type="button" class="btn btn--outline btn--sm" (click)="copy('pin', c.pin)">
          <tk-icon [name]="copied() === 'pin' ? 'check' : 'copy'" />
          {{ (copied() === 'pin' ? 'panel.access.copied' : 'panel.access.copy') | transloco }}
        </button>
      </div>
      <button type="button" class="btn btn--primary creds__all" (click)="copy('all', message())">
        <tk-icon [name]="copied() === 'all' ? 'check' : 'send'" />
        {{ (copied() === 'all' ? 'panel.access.copied' : 'panel.access.copyMessage') | transloco }}
      </button>
    </section>
  `,
  styles: `
    .creds {
      display: grid; gap: 0.35rem; padding: 1rem 1.1rem;
      border: 1px solid color-mix(in oklch, var(--warning) 50%, var(--border)); border-radius: var(--radius);
      background: color-mix(in oklch, var(--warning) 7%, var(--card)); text-align: left;
    }
    .creds__head { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; }
    .creds__icon {
      display: grid; flex: none; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: 50%;
      background: color-mix(in oklch, var(--warning) 18%, transparent); color: var(--warning); --icon-size: 1rem;
    }
    .creds__title { margin: 0; font-size: 0.95rem; font-weight: 650; }
    .creds__warn { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--muted-foreground); }
    .creds__label { font-size: 0.75rem; font-weight: 600; color: var(--muted-foreground); }
    .creds__row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
    .creds__value {
      flex: 1; min-width: 0; padding: 0.45rem 0.6rem; border-radius: calc(var(--radius) * 0.6);
      background: var(--background); border: 1px solid var(--input);
      font-size: 0.78rem; overflow-wrap: anywhere; user-select: all;
    }
    .creds__pin { font-size: 1.2rem; letter-spacing: 0.35em; font-weight: 700; }
    .creds__all { width: 100%; margin-top: 0.35rem; }
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
