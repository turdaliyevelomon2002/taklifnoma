import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerSession } from './owner-session.service';
import { IconComponent } from './ui/icon.component';

@Component({
  selector: 'tk-panel-login',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <aside class="auth__brand">
        <div class="auth__logo">
          <span class="brand-mark"><tk-icon name="heart" /></span>
          Taklifnoma
        </div>
        <div class="auth__pitch">
          <h2>{{ 'panel.login.brandTitle' | transloco }}</h2>
          <p>{{ 'panel.login.brandText' | transloco }}</p>
        </div>
        <span></span>
      </aside>

      <div class="auth__form-wrap">
        <form class="auth__form" (submit)="$event.preventDefault(); submit(email.value, password.value)" novalidate>
          <div class="auth__mobile-logo">
            <span class="brand-mark"><tk-icon name="heart" /></span>
            Taklifnoma
          </div>
          <h1>{{ 'panel.login.welcome' | transloco }}</h1>
          <p class="auth__sub">{{ 'panel.login.subtitle' | transloco }}</p>

          <label class="field">
            <span class="label">{{ 'panel.login.email' | transloco }}</span>
            <span class="input-icon">
              <tk-icon name="mail" />
              <input #email class="input" type="email" autocomplete="username" required maxlength="200" autofocus />
            </span>
          </label>
          <label class="field">
            <span class="label">{{ 'panel.login.password' | transloco }}</span>
            <span class="input-icon">
              <tk-icon name="lock" />
              <input
                #password
                class="input"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
                required
                maxlength="200"
              />
              <button
                type="button"
                class="btn btn--icon btn--sm input-icon__end"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="(showPassword() ? 'panel.login.hidePassword' : 'panel.login.showPassword') | transloco"
                [attr.aria-pressed]="showPassword()"
              >
                <tk-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
              </button>
            </span>
          </label>

          @if (error(); as key) {
            <p class="alert" role="alert"><tk-icon name="alert-triangle" /> {{ key | transloco }}</p>
          }

          <button type="submit" class="btn btn--primary btn--lg btn--block" [disabled]="busy()">
            @if (busy()) {
              <tk-icon name="loader" class="spin" />
            }
            {{ (busy() ? 'panel.login.submitting' : 'panel.login.submit') | transloco }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class PanelLoginPage {
  /** Kirgandan keyin qaytiladigan sahifa (?next=...). */
  readonly next = input<string>();

  private readonly session = inject(OwnerSession);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

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
