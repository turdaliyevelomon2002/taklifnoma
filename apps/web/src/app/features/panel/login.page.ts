import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerSession } from './owner-session.service';

@Component({
  selector: 'tk-panel-login',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="login card" (submit)="$event.preventDefault(); submit(email.value, password.value)" novalidate>
      <h1 class="login__title">Taklifnoma · {{ 'panel.title' | transloco }}</h1>
      <p class="muted login__text">{{ 'panel.login.subtitle' | transloco }}</p>
      <label class="field">
        <span class="label">{{ 'panel.login.email' | transloco }}</span>
        <input #email class="input" type="email" autocomplete="username" required maxlength="200" />
      </label>
      <label class="field">
        <span class="label">{{ 'panel.login.password' | transloco }}</span>
        <input #password class="input" type="password" autocomplete="current-password" required maxlength="200" />
      </label>
      @if (error(); as key) {
        <p class="alert" role="alert">{{ key | transloco }}</p>
      }
      <button type="submit" class="btn btn--primary login__submit" [disabled]="busy()">
        {{ (busy() ? 'panel.login.submitting' : 'panel.login.submit') | transloco }}
      </button>
    </form>
  `,
  styles: `
    .login { max-width: 24rem; margin: 12vh auto 0; padding: 1.75rem 1.5rem; box-shadow: var(--tk-shadow); }
    .login__title { margin: 0 0 0.25rem; font-size: 1.35rem; }
    .login__text { margin: 0 0 1.25rem; font-size: 0.9rem; }
    .login__submit { width: 100%; margin-top: 0.5rem; }
  `,
})
export class PanelLoginPage {
  /** Kirgandan keyin qaytiladigan sahifa (?next=...). */
  readonly next = input<string>();

  private readonly session = inject(OwnerSession);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(email: string, password: string): Promise<void> {
    if (!email.trim() || !password) {
      this.error.set('panel.validation.required');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.session.login(email.trim(), password);
      const next = this.next();
      // Faqat panel ichidagi manzilga qaytaramiz (open redirect bo'lmasin).
      await this.router.navigateByUrl(next?.startsWith('/panel') && !next.startsWith('//') ? next : '/panel');
    } catch (err) {
      const code = toApiError(err).code;
      // errors.INVALID_CREDENTIALS juftlik (PIN) uchun yozilgan; owner uchun alohida matn.
      this.error.set(code === 'INVALID_CREDENTIALS' ? 'panel.login.invalid' : errorKey(code));
    } finally {
      this.busy.set(false);
    }
  }
}
