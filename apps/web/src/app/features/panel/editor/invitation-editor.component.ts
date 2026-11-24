import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  isValidSlug,
  PACKAGE_FEATURES,
  PACKAGE_TYPES,
  resolveFeatures,
  suggestSlug,
  TEMPLATE_KEYS,
  type CreateInvitationResult,
  type FeatureOverrides,
  type InvitationDetail,
} from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../../core/api/api-error';
import { OwnerApi } from '../../../core/api/owner-api.service';
import { FieldErrorComponent } from './field-error.component';
import { FormErrors } from './form-errors';
import {
  BOOLEAN_FEATURES,
  buildEventGroup,
  buildInput,
  buildInvitationForm,
  paidAtToIso,
  patchFromDetail,
  serverIssues,
  type BooleanFeature,
} from './invitation-form.model';
import { LocalizedFieldComponent } from './localized-field.component';

type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Taklifnoma formasi: yaratish (detail = null) va tahrirlash uchun bitta komponent.
 * Tekshiruv backend bilan bir xil Zod sxemasi orqali (packages/shared).
 */
@Component({
  selector: 'tk-invitation-editor',
  imports: [ReactiveFormsModule, TranslocoPipe, LocalizedFieldComponent, FieldErrorComponent],
  providers: [FormErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invitation-editor.component.html',
  styleUrl: './invitation-editor.component.scss',
})
export class InvitationEditorComponent {
  readonly detail = input<InvitationDetail | null>(null);
  readonly created = output<CreateInvitationResult>();
  readonly saved = output<InvitationDetail>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(OwnerApi);
  protected readonly errors = inject(FormErrors);

  protected readonly form = buildInvitationForm(this.fb);
  protected readonly templates = TEMPLATE_KEYS;
  protected readonly packages = PACKAGE_TYPES;
  protected readonly booleanFeatures = BOOLEAN_FEATURES;

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly savedAt = signal<Date | null>(null);
  protected readonly slugState = signal<SlugState>('idle');

  protected readonly isEdit = computed(() => !!this.detail());

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly showRu = computed(() => !!this.value().settings?.ru);
  protected readonly packageType = computed(() => this.value().order?.package ?? 'STANDARD');
  /** Paket + istisnolar natijasi: owner nima yoqilganini ko'rib turadi. */
  protected readonly effectiveFeatures = computed(() => {
    const f = this.value().features ?? {};
    const overrides: FeatureOverrides = {};
    for (const k of BOOLEAN_FEATURES) if (f[k] && f[k] !== 'package') overrides[k] = f[k] === 'on';
    if (f.galleryLimit !== null && f.galleryLimit !== undefined && String(f.galleryLimit) !== '') {
      overrides.galleryLimit = Number(f.galleryLimit);
    }
    return resolveFeatures(this.packageType(), overrides);
  });
  protected readonly packageFeatures = computed(() => PACKAGE_FEATURES[this.packageType()]);

  /** Yaratishda: owner slug'ni qo'lda o'zgartirmaguncha ismlardan avtomatik yasaladi. */
  private slugTouched = false;
  private slugTimer: ReturnType<typeof setTimeout> | undefined;
  private slugSeq = 0;

  constructor() {
    effect(() => {
      const d = this.detail();
      untracked(() => {
        if (d) {
          patchFromDetail(this.form, this.fb, d);
          this.slugTouched = true;
          this.slugState.set('idle');
        } else if (this.form.controls.events.length === 0) {
          this.form.controls.events.push(buildEventGroup(this.fb, true));
        }
      });
    });

    const names = [
      this.form.controls.couple.controls.groom.controls.firstName.controls.uz,
      this.form.controls.couple.controls.bride.controls.firstName.controls.uz,
    ];
    for (const control of names) {
      control.valueChanges.subscribe(() => {
        if (this.slugTouched) return;
        const [groom, bride] = names.map((c) => c.value);
        const order = this.form.controls.couple.controls.order.value;
        const slug = suggestSlug(...(order === 'bride-first' ? [bride, groom] : [groom, bride]));
        this.form.controls.order.controls.slug.setValue(slug);
        this.checkSlug(slug);
      });
    }

    inject(DestroyRef).onDestroy(() => clearTimeout(this.slugTimer));
  }

  // --- Slug ---

  protected onSlugInput(value: string): void {
    this.slugTouched = true;
    this.checkSlug(value);
  }

  private checkSlug(raw: string): void {
    clearTimeout(this.slugTimer);
    const slug = raw.trim().toLowerCase();
    if (!slug) return this.slugState.set('idle');
    if (this.detail()?.slug === slug) return this.slugState.set('idle');
    if (!isValidSlug(slug)) return this.slugState.set('invalid');
    this.slugState.set('checking');
    const seq = ++this.slugSeq;
    this.slugTimer = setTimeout(async () => {
      try {
        const available = await this.api.slugAvailable(slug);
        if (seq === this.slugSeq) this.slugState.set(available ? 'available' : 'taken');
      } catch {
        if (seq === this.slugSeq) this.slugState.set('idle');
      }
    }, 400);
  }

  // --- Tadbirlar ---

  protected get events() {
    return this.form.controls.events;
  }

  protected addEvent(): void {
    this.events.push(buildEventGroup(this.fb, this.events.length === 0));
  }

  protected removeEvent(index: number): void {
    const wasPrimary = this.events.at(index).controls.isPrimary.value;
    this.events.removeAt(index);
    if (wasPrimary && this.events.length) this.events.at(0).controls.isPrimary.setValue(true);
  }

  protected moveEvent(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.events.length) return;
    const group = this.events.at(index);
    this.events.removeAt(index);
    this.events.insert(target, group);
  }

  protected setPrimary(index: number): void {
    this.events.controls.forEach((g, i) => g.controls.isPrimary.setValue(i === index));
  }

  protected featureLabelState(key: BooleanFeature): boolean {
    return this.packageFeatures()[key];
  }

  // --- Saqlash ---

  protected async submit(): Promise<void> {
    this.saveError.set(null);
    const { input, errors } = buildInput(this.form.getRawValue());
    this.errors.set(errors);
    if (!input) {
      this.saveError.set('panel.form.fixErrors');
      queueMicrotask(() => document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }

    this.saving.set(true);
    try {
      const d = this.detail();
      if (!d) {
        this.created.emit(await this.api.create(input));
      } else {
        const overrides = input.featureOverrides ?? {};
        const updated = await this.api.update(d.id, {
          ...input,
          price: input.price ?? null,
          notes: input.notes ?? null,
          featureOverrides: Object.keys(overrides).length ? overrides : null,
          paidAt: paidAtToIso(this.form.controls.order.controls.paidAt.value, input.config.timezone),
        });
        this.savedAt.set(new Date());
        this.saved.emit(updated);
      }
      this.errors.clear();
    } catch (err) {
      const e = toApiError(err);
      if (e.code === 'VALIDATION_ERROR') this.errors.set(serverIssues(e.body?.issues));
      if (e.code === 'SLUG_TAKEN') {
        this.slugState.set('taken');
        this.errors.set(new Map([['slug', 'errors.SLUG_TAKEN']]));
      }
      this.saveError.set(errorKey(e.code));
    } finally {
      this.saving.set(false);
    }
  }
}
