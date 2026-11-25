import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import type { RsvpConfig, RsvpSubmitResult } from '@taklifnoma/shared';
import { normalizeUzPhone } from '@taklifnoma/shared/phone';
import { errorKey, toApiError } from '../../../../core/api/api-error';
import { RsvpApi } from '../../../../core/api/rsvp-api.service';
import { LangService } from '../../../../core/i18n/lang.service';
import { EventDatePipe } from '../../../../shared/date/event-date.pipe';
import { WishesStore } from '../../wishes.store';

/** Faqat UX uchun; haqiqiy qiymatlar backend'dagi RSVP_LIMITS'da. */
const NAME_MIN = 2;
const NAME_MAX = 100;
const WISH_MAX = 1000;


interface SavedReply {
  name: string;
  phone: string;
  attending: boolean;
  guestCount: number;
}

function phoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value || value === '+998') return null; // "required" alohida tekshiriladi
  return normalizeUzPhone(value) ? null : { phone: true };
}

function phoneRequired(control: AbstractControl<string>): ValidationErrors | null {
  const digits = (control.value ?? '').replace(/\D/g, '');
  return digits.length <= 3 ? { required: true } : null;
}

type State =
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'done'; result: RsvpSubmitResult['status']; attending: boolean; name: string };

@Component({
  selector: 'tk-rsvp-form',
  imports: [ReactiveFormsModule, TranslocoPipe, EventDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rsvp-form.component.html',
  styleUrl: './rsvp-form.component.scss',
})
export class RsvpFormComponent {
  /** Muvaffaqiyat animatsiyasidagi konfetti bo'laklari (har biri o'z yo'nalishida). */
  protected readonly confetti = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  readonly slug = input.required<string>();
  readonly rules = input.required<RsvpConfig>();
  readonly open = input.required<boolean>();
  readonly timezone = input.required<string>();

  protected readonly lang = inject(LangService).lang;
  private readonly api = inject(RsvpApi);
  private readonly wishes = inject(WishesStore, { optional: true });
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly limits = { nameMin: NAME_MIN, nameMax: NAME_MAX, wishMax: WISH_MAX };

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(NAME_MIN), Validators.maxLength(NAME_MAX)]],
    phone: ['+998 ', [phoneValidator]],
    attending: this.fb.control<boolean | null>(null, Validators.required),
    guestCount: [1, [Validators.min(1)]],
    wish: ['', [Validators.maxLength(WISH_MAX)]],
    /** Honeypot: ekrandan yashirilgan, odam to'ldirmaydi. */
    website: [''],
  });

  protected readonly state = signal<State>({ kind: 'form' });
  /** Xato matnining i18n kaliti. */
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  private readonly attendingValue = toSignal(this.form.controls.attending.valueChanges, {
    initialValue: this.form.controls.attending.value,
  });
  private readonly guestValue = toSignal(this.form.controls.guestCount.valueChanges, {
    initialValue: 1,
  });
  private readonly wishValue = toSignal(this.form.controls.wish.valueChanges, { initialValue: '' });

  protected readonly attending = computed(() => this.attendingValue());
  protected readonly guestCount = computed(() => this.guestValue());
  protected readonly wishLength = computed(() => this.wishValue().length);

  private token: Promise<string> | null = null;

  constructor() {
    afterNextRender(() => {
      const rules = this.rules();
      const phone = this.form.controls.phone;
      phone.setValidators(rules.askPhone ? [phoneRequired, phoneValidator] : [phoneValidator]);
      phone.updateValueAndValidity({ emitEvent: false });

      if (this.open()) {
        this.restore();
        this.token = this.api.token(this.slug());
        // Xatoni shu yerda "yutamiz"; submit paytida qayta olinadi.
        this.token.catch(() => (this.token = null));
      }
    });
  }

  protected setAttending(value: boolean): void {
    this.form.controls.attending.setValue(value);
    this.form.controls.attending.markAsTouched();
  }

  protected stepGuests(delta: number): void {
    const max = this.rules().maxGuestsPerReply;
    const next = Math.min(max, Math.max(1, this.form.controls.guestCount.value + delta));
    this.form.controls.guestCount.setValue(next);
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const attending = v.attending === true;
    const phoneDigits = v.phone.replace(/\D/g, '');
    this.state.set({ kind: 'submitting' });

    try {
      const formToken = await (this.token ??= this.api.token(this.slug()));
      const res = await this.api.submit(this.slug(), {
        name: v.name.trim(),
        phone: phoneDigits.length > 3 ? v.phone : undefined,
        attending,
        guestCount: attending ? v.guestCount : 0,
        wish: this.rules().askWish ? v.wish.trim() || undefined : undefined,
        locale: this.lang(),
        formToken,
        website: v.website || undefined,
      });
      this.save({ name: v.name.trim(), phone: v.phone, attending, guestCount: v.guestCount });
      if (v.wish.trim()) this.wishes?.bump();
      this.state.set({ kind: 'done', result: res.status, attending, name: v.name.trim() });
    } catch (err) {
      const code = toApiError(err).code;
      // Eskirgan token: yangisini olamiz, foydalanuvchi qayta bosadi.
      if (code === 'FORM_EXPIRED' || code === 'SPAM_DETECTED') {
        this.token = this.api.token(this.slug());
        this.token.catch(() => (this.token = null));
      }
      this.error.set(errorKey(code));
      this.state.set({ kind: 'form' });
    }
  }

  protected edit(): void {
    this.state.set({ kind: 'form' });
  }

  private storageKey(): string {
    return `tk-rsvp:${this.slug()}`;
  }

  /** Avval javob bergan mehmon sahifani qayta ochsa, natija ko'rsatiladi (faqat shu qurilmada). */
  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedReply;
      this.form.patchValue(saved);
      this.state.set({ kind: 'done', result: 'created', attending: saved.attending, name: saved.name });
    } catch {
      /* localStorage mavjud emas yoki buzilgan */
    }
  }

  private save(reply: SavedReply): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(reply));
    } catch {
      /* Shaxsiy rejim: saqlamasak ham bo'ladi */
    }
  }
}
