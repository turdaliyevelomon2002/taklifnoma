import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PIN_LENGTH } from '@taklifnoma/shared/enums';
import { errorKey, toApiError } from '../../core/api/api-error';
import { CoupleApi } from '../../core/api/couple-api.service';

@Component({
  selector: 'tk-pin-login',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="login" (submit)="$event.preventDefault(); submit()" novalidate>
      <div class="login__icon" aria-hidden="true">♥</div>
      <h1 class="login__title">{{ 'admin.login.title' | transloco }}</h1>
      <p class="login__text">{{ 'admin.login.subtitle' | transloco }}</p>

      <label class="visually-hidden" for="pin">{{ 'admin.login.pin' | transloco }}</label>
      <input
        #pinInput
        id="pin"
        class="login__pin"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        [attr.maxlength]="length"
        [placeholder]="'•'.repeat(length)"
        [value]="pin()"
        (input)="onInput(pinInput.value)"
        [attr.aria-invalid]="!!error()"
        aria-describedby="pin-error"
      />

      @if (error(); as key) {
        <p id="pin-error" class="login__error" role="alert">{{ key | transloco }}</p>
      }

      <button type="submit" class="tk-btn login__submit" [disabled]="busy() || pin().length !== length">
        {{ (busy() ? 'admin.login.submitting' : 'admin.login.submit') | transloco }}
      </button>
      <p class="login__hint">{{ 'admin.login.linkHint' | transloco }}</p>
    </form>
  `,
  styles: `
    .login {
      max-width: 22rem;
      margin: 10vh auto 0;
      padding: 2rem 1.5rem;
      border: 1px solid var(--tk-border);
      border-radius: calc(var(--tk-radius) * 1.5);
      background: var(--tk-surface);
      box-shadow: var(--tk-shadow);
      text-align: center;
    }
    .login__icon { font-size: 1.75rem; color: var(--tk-primary); }
    .login__title { margin: 0.25rem 0 0.5rem; font-size: 1.4rem; }
    .login__text { margin: 0 0 1.25rem; color: var(--tk-muted); font-size: 0.9rem; }
    .login__pin {
      width: 100%;
      padding: 0.7rem;
      border: 1px solid var(--tk-border);
      border-radius: var(--tk-radius);
      background: var(--tk-bg);
      font: inherit;
      font-size: 1.75rem;
      letter-spacing: 0.5em;
      text-indent: 0.5em;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .login__pin:focus { outline: none; border-color: var(--tk-primary); }
    .login__pin[aria-invalid='true'] { border-color: #b3261e; }
    .login__error { margin: 0.75rem 0 0; color: #b3261e; font-size: 0.875rem; }
    .login__submit { width: 100%; margin-top: 1rem; }
    .login__submit:disabled { opacity: 0.55; cursor: default; }
    .login__hint { margin: 1rem 0 0; font-size: 0.8rem; color: var(--tk-muted); }
  `,
})
export class PinLoginComponent {
  readonly slug = input.required<string>();
  readonly initialError = input<string | null>(null);
  readonly loggedIn = output<void>();

  private readonly api = inject(CoupleApi);
  private readonly pinInput = viewChild.required<ElementRef<HTMLInputElement>>('pinInput');

  protected readonly length = PIN_LENGTH;
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => this.error.set(this.initialError()));
    effect(() => this.pinInput().nativeElement.focus());
  }

  protected onInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
    this.pin.set(digits);
    this.pinInput().nativeElement.value = digits;
    this.error.set(null);
    // 6 ta raqam terilganda avtomatik yuboriladi.
    if (digits.length === PIN_LENGTH) void this.submit();
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.pin().length !== PIN_LENGTH) return;
    this.busy.set(true);
    try {
      await this.api.loginWithPin(this.slug(), this.pin());
      this.loggedIn.emit();
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
      this.pin.set('');
      this.pinInput().nativeElement.value = '';
      this.pinInput().nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }
}
