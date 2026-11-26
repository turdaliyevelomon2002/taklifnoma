import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  isValidSlug,
  PACKAGE_FEATURES,
  PACKAGE_TYPES,
  resolveFeatures,
  suggestSlug,
  TEMPLATE_KEYS,
  invitationDraftConfigSchema,
  type CreateInvitationResult,
  type FeatureOverrides,
  type InvitationConfig,
  type InvitationDetail,
  type Locale,
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
import { isPreviewMessage, type PreviewReady, type PreviewUpdate } from '../preview/preview-protocol';
import { IconComponent, type IconName } from '../ui/icon.component';

/** Muharrir bo'limlari: chap navigatsiya, xato belgilari va scroll shu ro'yxatdan. */
export const EDITOR_SECTIONS: readonly { id: string; icon: IconName; prefixes: readonly string[] }[] = [
  { id: 'order', icon: 'banknote', prefixes: ['customerName', 'customerPhone', 'price', 'paidAt', 'notes', 'package'] },
  { id: 'couple', icon: 'heart', prefixes: ['config.couple', 'config.locales', 'slug'] },
  { id: 'events', icon: 'calendar', prefixes: ['config.events'] },
  { id: 'texts', icon: 'type', prefixes: ['config.greeting', 'config.closingText', 'config.hashtag', 'config.musicTitle'] },
  { id: 'design', icon: 'palette', prefixes: ['templateKey', 'config.theme', 'config.defaultLocale', 'config.timezone'] },
  { id: 'rsvp', icon: 'mail', prefixes: ['config.rsvp'] },
  { id: 'seo', icon: 'globe', prefixes: ['config.seo'] },
  { id: 'features', icon: 'settings', prefixes: ['featureOverrides'] },
];

const PREVIEW_DEBOUNCE_MS = 250;

type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Taklifnoma formasi: yaratish (detail = null) va tahrirlash uchun bitta komponent.
 * Tekshiruv backend bilan bir xil Zod sxemasi orqali (packages/shared).
 */
@Component({
  selector: 'tk-invitation-editor',
  imports: [ReactiveFormsModule, TranslocoPipe, LocalizedFieldComponent, FieldErrorComponent, IconComponent],
  providers: [FormErrors],
  host: { '(document:keydown)': 'onKeydown($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invitation-editor.component.html',
  styleUrl: './invitation-editor.component.scss',
})
export class InvitationEditorComponent {
  readonly detail = input<InvitationDetail | null>(null);
  /** Ochilganda shu bo'limga scroll qilinadi (masalan, "Umumiy" tabdagi "To'ldirish" tugmasidan). */
  readonly initialSection = input<string | undefined>(undefined);
  readonly created = output<CreateInvitationResult>();
  readonly saved = output<InvitationDetail>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(OwnerApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly errors = inject(FormErrors);
  protected readonly sections = EDITOR_SECTIONS;

  protected readonly form = buildInvitationForm(this.fb);
  protected readonly templates = TEMPLATE_KEYS;
  protected readonly packages = PACKAGE_TYPES;
  protected readonly booleanFeatures = BOOLEAN_FEATURES;

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly savedAt = signal<Date | null>(null);
  protected readonly slugState = signal<SlugState>('idle');

  protected readonly isEdit = computed(() => !!this.detail());

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // --- Saqlanmagan o'zgarishlar ---

  /** Oxirgi saqlangan (yoki yuklangan) holat: JSON ko'rinishida solishtiriladi. */
  private readonly baseline = signal<string | null>(null);
  readonly dirty = computed(() => {
    const base = this.baseline();
    return base !== null && JSON.stringify(this.value()) !== base;
  });

  // --- Bo'limlar navigatsiyasi ---

  protected readonly activeSection = signal<string>(EDITOR_SECTIONS[0]!.id);
  protected readonly sectionErrors = computed(() => {
    const keys = [...this.errors.map().keys()];
    return Object.fromEntries(
      EDITOR_SECTIONS.map((sec) => [
        sec.id,
        keys.filter((k) => sec.prefixes.some((p) => k === p || k.startsWith(p + '.'))).length,
      ]),
    ) as Record<string, number>;
  });

  // --- Jonli preview (faqat tahrirlashda: media va slug serverdan olinadi) ---

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  protected readonly previewSrc = computed(() => {
    const d = this.detail();
    return d ? this.sanitizer.bypassSecurityTrustResourceUrl(this.previewPath(d.id) + '?embed=1') : null;
  });
  protected readonly previewTabUrl = computed(() => {
    const d = this.detail();
    return d ? this.previewPath(d.id) : null;
  });
  protected readonly previewLocale = signal<Locale>('uz');
  /** Forma hozir preview qila olmaydigan holatda (masalan, ism bo'sh). */
  protected readonly previewPaused = signal(false);
  protected readonly previewLoading = signal(true);
  /** Tor ekranda preview oynasi (overlay). */
  protected readonly previewOpen = signal(false);
  private previewReady = false;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
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
          this.previewLocale.set(d.config.defaultLocale);
        } else if (this.form.controls.events.length === 0) {
          this.form.controls.events.push(buildEventGroup(this.fb, true));
        }
        this.markPristine();
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

    // Preview: forma yoki preview tili o'zgarganda (debounce bilan) iframe'ga yuboriladi.
    effect(() => {
      this.value();
      this.effectiveFeatures();
      this.previewLocale();
      untracked(() => {
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => this.postPreview(), PREVIEW_DEBOUNCE_MS);
      });
    });

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== this.frame()?.nativeElement.contentWindow) return;
      if (isPreviewMessage<PreviewReady>(e.data, 'tk-preview:ready')) {
        this.previewReady = true;
        this.previewLoading.set(false);
        this.postPreview();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (this.dirty()) e.preventDefault();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onBeforeUnload);

    afterNextRender(() => {
      this.observeSections();
      const section = this.initialSection();
      // Router navigatsiyadan keyin sahifani tepaga qaytaradi: scroll undan keyin bo'lsin.
      if (section && EDITOR_SECTIONS.some((s) => s.id === section)) setTimeout(() => this.goToSection(section), 120);
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.slugTimer);
      clearTimeout(this.previewTimer);
      this.sectionObserver?.disconnect();
      window.removeEventListener('message', onMessage);
      window.removeEventListener('beforeunload', onBeforeUnload);
    });
  }

  private previewPath(id: string): string {
    return '/panel/i/' + encodeURIComponent(id) + '/preview';
  }

  private markPristine(): void {
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
  }

  /** Saqlanmagan o'zgarishlarni bekor qilish: oxirgi saqlangan holatga qaytadi. */
  protected discard(): void {
    const d = this.detail();
    if (!d) return;
    patchFromDetail(this.form, this.fb, d);
    this.slugState.set('idle');
    this.errors.clear();
    this.saveError.set(null);
    this.markPristine();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!this.saving()) void this.submit();
    } else if (e.key === 'Escape' && this.previewOpen()) {
      this.previewOpen.set(false);
    }
  }

  // --- Bo'limlar ---

  private sectionObserver?: IntersectionObserver;

  private observeSections(): void {
    const els = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-section]');
    // Ekranning yuqori qismidagi bo'lim faol hisoblanadi.
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) this.activeSection.set((visible[0]!.target as HTMLElement).dataset['section']!);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    els.forEach((el) => this.sectionObserver!.observe(el));
  }

  protected goToSection(id: string): void {
    this.activeSection.set(id);
    this.host.nativeElement
      .querySelector('[data-section="' + id + '"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected goToFirstError(): void {
    // Render tugagach: xato yozuvlari DOM'ga tushgan bo'lsin.
    setTimeout(() =>
      this.host.nativeElement.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  }

  // --- Preview ---

  private postPreview(): void {
    const win = this.frame()?.nativeElement.contentWindow;
    if (!win || !this.previewReady) return;
    const { config, templateKey } = buildInput(this.form.getRawValue());
    const parsed = invitationDraftConfigSchema.safeParse(config);
    this.previewPaused.set(!parsed.success);
    if (!parsed.success) return;
    const wanted = this.previewLocale();
    const msg: PreviewUpdate = {
      type: 'tk-preview:update',
      templateKey,
      // Shablonlar to'yxona ma'lumotlari yo'qligini o'zi hisobga oladi (qoralama).
      config: parsed.data as InvitationConfig,
      features: this.effectiveFeatures(),
      locale: parsed.data.locales.includes(wanted) ? wanted : parsed.data.defaultLocale,
    };
    win.postMessage(msg, location.origin);
  }

  protected reloadPreview(): void {
    const win = this.frame()?.nativeElement.contentWindow;
    if (!win) return;
    this.previewReady = false;
    this.previewLoading.set(true);
    win.location.reload();
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
      this.goToFirstError();
      return;
    }

    this.saving.set(true);
    try {
      const d = this.detail();
      if (!d) {
        const result = await this.api.create(input);
        this.markPristine(); // sahifadan chiqishda ogohlantirish chiqmasin
        this.created.emit(result);
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
        this.markPristine();
        this.saved.emit(updated);
      }
      this.errors.clear();
    } catch (err) {
      const e = toApiError(err);
      if (e.code === 'VALIDATION_ERROR' || e.code === 'INVITATION_INCOMPLETE') this.errors.set(serverIssues(e.body?.issues));
      if (e.code === 'SLUG_TAKEN') {
        this.slugState.set('taken');
        this.errors.set(new Map([['slug', 'errors.SLUG_TAKEN']]));
      }
      this.saveError.set(errorKey(e.code));
      if (this.errors.count()) this.goToFirstError();
    } finally {
      this.saving.set(false);
    }
  }
}
