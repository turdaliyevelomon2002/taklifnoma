import { DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CONFIG_VERSION,
  createInvitationSchema,
  PACKAGE_TYPES,
  suggestSlug,
  TEMPLATE_KEYS,
  type CreateInvitationResult,
  type PackageType,
  type TemplateKey,
} from '@taklifnoma/shared';
import { firstValueFrom } from 'rxjs';
import { errorKey, toApiError } from '../../../core/api/api-error';
import { OwnerApi } from '../../../core/api/owner-api.service';
import { LangService } from '../../../core/i18n/lang.service';
import { zonedInputToIso } from '../../../shared/date/zoned-input';
import { CredentialsCardComponent } from '../credentials-card.component';
import { issueKey } from '../editor/invitation-form.model';
import { IconComponent } from '../ui/icon.component';
import { QuickCreate } from './quick-create.service';

const TIMEZONE = 'Asia/Tashkent';
type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Tezkor yaratish: faqat eng kerakli maydonlar. Qoralama yaratiladi (to'yxona, matnlar keyin),
 * to'liqlik chop etishda serverda tekshiriladi. Kirish ma'lumotlari (PIN) faqat shu yerda bir marta ko'rinadi.
 */
@Component({
  selector: 'tk-quick-create-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, IconComponent, CredentialsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as r) {
      <div class="dialog__head qc-done">
        <span class="qc-done__icon"><tk-icon name="circle-check" /></span>
        <h2>{{ 'panel.quick.createdTitle' | transloco }}</h2>
        <p>{{ 'panel.quick.createdText' | transloco: { names: r.invitation.coupleNames } }}</p>
      </div>
      <div class="dialog__body">
        <tk-credentials-card [credentials]="r.access" [messageText]="shareText(r)" />
      </div>
      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close(r)">{{ 'panel.shell.close' | transloco }}</button>
        <button type="button" class="btn btn--primary" (click)="openEditor(r)">
          {{ 'panel.quick.continue' | transloco }} <tk-icon name="chevron-right" />
        </button>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="dialog__head">
          <h2>{{ 'panel.quick.title' | transloco }}</h2>
          <p>{{ 'panel.quick.subtitle' | transloco }}</p>
        </div>

        <div class="dialog__body qc">
          <div class="qc__row">
            <label class="field">
              <span class="label">{{ 'panel.form.groom' | transloco }}</span>
              <input class="input" formControlName="groom" maxlength="50" autocomplete="off" (input)="syncSlug()" [attr.aria-invalid]="!!err('groom')" cdkFocusInitial />
              @if (err('groom'); as e) { <span class="hint hint--bad">{{ e | transloco }}</span> }
            </label>
            <label class="field">
              <span class="label">{{ 'panel.form.bride' | transloco }}</span>
              <input class="input" formControlName="bride" maxlength="50" autocomplete="off" (input)="syncSlug()" [attr.aria-invalid]="!!err('bride')" />
              @if (err('bride'); as e) { <span class="hint hint--bad">{{ e | transloco }}</span> }
            </label>
          </div>

          <div class="qc__row">
            <label class="field">
              <span class="label">{{ 'panel.quick.date' | transloco }}</span>
              <input class="input" type="date" formControlName="date" [min]="today" [attr.aria-invalid]="!!err('date')" />
              @if (err('date'); as e) { <span class="hint hint--bad">{{ e | transloco }}</span> }
            </label>
            <label class="field">
              <span class="label">{{ 'panel.quick.time' | transloco }}</span>
              <input class="input" type="time" formControlName="time" />
            </label>
          </div>

          <div class="field">
            <span class="label">{{ 'panel.form.template' | transloco }}</span>
            <div class="qc__templates" role="radiogroup">
              @for (t of templates; track t) {
                <label class="qc__tpl" [class.is-active]="form.controls.templateKey.value === t">
                  <input type="radio" formControlName="templateKey" [value]="t" />
                  <span class="tpl-swatch tpl-swatch--{{ t }}" aria-hidden="true"></span>
                  <span class="qc__tpl-name">{{ 'panel.templates.' + t + '.name' | transloco }}</span>
                </label>
              }
            </div>
          </div>

          <div class="field">
            <span class="label">{{ 'panel.form.package' | transloco }}</span>
            <div class="seg" role="radiogroup">
              @for (p of packages; track p) {
                <label [class.is-active]="form.controls.package.value === p">
                  <input type="radio" formControlName="package" [value]="p" />
                  {{ 'admin.package.' + p | transloco }}
                </label>
              }
            </div>
            <span class="hint">{{ 'panel.packages.' + form.controls.package.value | transloco }}</span>
          </div>

          <div class="qc__sep"></div>

          <div class="qc__row">
            <label class="field">
              <span class="label">{{ 'panel.form.customerName' | transloco }}</span>
              <input class="input" formControlName="customerName" maxlength="100" autocomplete="off" [attr.aria-invalid]="!!err('customerName')" />
              @if (err('customerName'); as e) { <span class="hint hint--bad">{{ e | transloco }}</span> }
            </label>
            <label class="field">
              <span class="label">{{ 'panel.form.customerPhone' | transloco }}</span>
              <input class="input" formControlName="customerPhone" type="tel" inputmode="tel" placeholder="+998 90 123 45 67" maxlength="20" [attr.aria-invalid]="!!err('customerPhone')" />
              @if (err('customerPhone'); as e) { <span class="hint hint--bad">{{ e | transloco }}</span> }
            </label>
          </div>

          <div class="qc__row">
            <label class="field">
              <span class="label">{{ 'panel.form.price' | transloco }} <span class="optional">{{ 'panel.form.optional' | transloco }}</span></span>
              <input class="input" formControlName="price" type="number" min="0" step="1000" inputmode="numeric" />
            </label>
            <label class="field">
              <span class="label">{{ 'panel.form.slug' | transloco }}</span>
              <span class="qc__slug">
                <span class="qc__slug-prefix">/</span>
                <input class="input" formControlName="slug" maxlength="60" autocomplete="off" (input)="onSlugInput()" [attr.aria-invalid]="slugState() === 'taken' || slugState() === 'invalid'" />
              </span>
              @switch (slugState()) {
                @case ('checking') { <span class="hint">{{ 'panel.form.slugChecking' | transloco }}</span> }
                @case ('available') { <span class="hint hint--ok">✓ {{ 'panel.form.slugAvailable' | transloco }}</span> }
                @case ('taken') { <span class="hint hint--bad">{{ (slugEdited ? 'errors.SLUG_TAKEN' : 'panel.quick.slugAuto') | transloco }}</span> }
                @case ('invalid') { <span class="hint hint--bad">{{ 'panel.validation.invalid_slug' | transloco }}</span> }
              }
            </label>
          </div>

          @if (error(); as e) {
            <p class="alert" role="alert"><tk-icon name="alert-triangle" /> {{ e | transloco }}</p>
          }
        </div>

        <div class="dialog__foot qc__foot">
          <button type="button" class="link qc__full" (click)="openFullForm()">{{ 'panel.quick.fullForm' | transloco }}</button>
          <button type="button" class="btn" (click)="ref.close()">{{ 'admin.guests.cancel' | transloco }}</button>
          <button type="submit" class="btn btn--primary" [disabled]="busy()">
            @if (busy()) { <tk-icon name="loader" class="spin" /> }
            {{ 'panel.quick.create' | transloco }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    :host { display: block; }
    .qc { display: grid; gap: 0.15rem; }
    .qc__row { display: grid; gap: 0 0.9rem; }
    @media (min-width: 560px) { .qc__row { grid-template-columns: 1fr 1fr; } }
    .qc__sep { height: 1px; margin: 0.25rem 0 1rem; background: var(--border); }
    .qc__templates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
    .qc__tpl {
      position: relative; display: grid; gap: 0.4rem; padding: 0.45rem; border: 1px solid var(--border);
      border-radius: calc(var(--radius) * 0.7); cursor: pointer; transition: border-color 0.15s ease;
    }
    .qc__tpl:hover { border-color: var(--ring); }
    .qc__tpl.is-active { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
    .qc__tpl input { position: absolute; opacity: 0; pointer-events: none; }
    .qc__tpl:has(input:focus-visible) { outline: 2px solid var(--ring); outline-offset: 2px; }
    .qc__tpl-name { font-size: 0.78rem; font-weight: 600; text-align: center; }
    .qc__slug { display: flex; align-items: center; gap: 0.35rem; }
    .qc__slug-prefix { color: var(--muted-foreground); }
    .qc__foot { align-items: center; }
    .qc__full { margin-right: auto; }
    .qc-done { justify-items: center; text-align: center; }
    .qc-done__icon {
      display: grid; place-items: center; width: 3rem; height: 3rem; margin-bottom: 0.25rem; border-radius: 50%;
      background: color-mix(in oklch, var(--success) 14%, transparent); color: var(--success); --icon-size: 1.6rem;
    }
  `,
})
export class QuickCreateDialog {
  protected readonly ref = inject<DialogRef<CreateInvitationResult | undefined>>(DialogRef);
  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = inject(LangService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly quick = inject(QuickCreate);

  protected readonly templates = TEMPLATE_KEYS;
  protected readonly packages = PACKAGE_TYPES;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly form = this.fb.group({
    groom: ['', Validators.required],
    bride: ['', Validators.required],
    date: ['', Validators.required],
    time: ['18:00'],
    templateKey: this.fb.control<TemplateKey>('classic-gold'),
    package: this.fb.control<PackageType>('BASIC'),
    customerName: [''],
    customerPhone: [''],
    price: this.fb.control<number | null>(null),
    slug: [''],
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal(new Map<string, string>());
  protected readonly slugState = signal<SlugState>('idle');
  protected readonly result = signal<CreateInvitationResult | null>(null);
  /** Foydalanuvchi slug'ni o'zi o'zgartirgan bo'lsa, ismlardan avtomatik yangilanmaydi. */
  protected slugEdited = false;
  private slugTimer: ReturnType<typeof setTimeout> | undefined;
  private slugSeq = 0;

  constructor() {
    // Maydon o'zgarganda faqat o'sha maydonning xatosi o'chadi.
    let prev = this.form.getRawValue();
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const next = this.form.getRawValue();
      const errors = this.errors();
      if (errors.size) {
        const keep = new Map([...errors].filter(([k]) => prev[k as keyof typeof prev] === next[k as keyof typeof next]));
        if (keep.size !== errors.size) this.errors.set(keep);
      }
      prev = next;
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.slugTimer));
  }

  protected err(field: string): string | null {
    return this.errors().get(field) ?? null;
  }

  protected syncSlug(): void {
    if (this.slugEdited) return;
    const { groom, bride } = this.form.getRawValue();
    this.form.controls.slug.setValue(suggestSlug(groom, bride));
    this.scheduleSlugCheck();
  }

  protected onSlugInput(): void {
    this.slugEdited = true;
    this.scheduleSlugCheck();
  }

  private scheduleSlugCheck(): void {
    clearTimeout(this.slugTimer);
    const slug = this.form.controls.slug.value.trim().toLowerCase();
    if (!slug) {
      this.slugState.set('idle');
      return;
    }
    this.slugState.set('checking');
    this.slugTimer = setTimeout(() => void this.checkSlug(slug), 400);
  }

  private async checkSlug(slug: string): Promise<void> {
    const seq = ++this.slugSeq;
    const ok = createInvitationSchema.shape.slug.safeParse(slug).success;
    if (!ok) {
      this.slugState.set('invalid');
      return;
    }
    const free = await this.api.slugAvailable(slug).catch(() => true);
    if (seq === this.slugSeq) this.slugState.set(free ? 'available' : 'taken');
  }

  /** Avtomatik slug band bo'lsa, -2, -3 ... qo'shib bo'shini topamiz. */
  private async resolveSlug(base: string): Promise<string> {
    if (this.slugEdited || (await this.api.slugAvailable(base).catch(() => true))) return base;
    for (let i = 2; i <= 9; i++) {
      const candidate = `${base}-${i}`;
      if (await this.api.slugAvailable(candidate).catch(() => false)) return candidate;
    }
    return base;
  }

  protected async submit(): Promise<void> {
    const v = this.form.getRawValue();
    const errors = new Map<string, string>();
    if (!v.groom.trim()) errors.set('groom', 'panel.validation.required');
    if (!v.bride.trim()) errors.set('bride', 'panel.validation.required');
    const startsAt = v.date ? zonedInputToIso(`${v.date}T${v.time || '18:00'}`, TIMEZONE) : null;
    if (!startsAt) errors.set('date', 'panel.validation.required');
    this.errors.set(errors);
    if (errors.size) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      // Tadbir nomi taklifnoma matni: panel tili qaysi bo'lishidan qat'i nazar o'zbekcha.
      const eventTitle = await firstValueFrom(this.transloco.selectTranslate('panel.quick.defaultEventTitle', {}, 'uz'));
      const slug = await this.resolveSlug(v.slug.trim().toLowerCase() || suggestSlug(v.groom, v.bride));
      const raw = {
        slug,
        templateKey: v.templateKey,
        package: v.package,
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        price: v.price === null || String(v.price) === '' ? undefined : Number(v.price),
        config: {
          version: CONFIG_VERSION,
          locales: ['uz'],
          defaultLocale: 'uz',
          timezone: TIMEZONE,
          couple: { groom: { firstName: { uz: v.groom } }, bride: { firstName: { uz: v.bride } } },
          events: [{ id: 'main', title: { uz: eventTitle }, startsAt, venue: {}, isPrimary: true }],
          rsvp: {},
        },
      };
      const parsed = createInvitationSchema.safeParse(raw);
      if (!parsed.success) {
        this.errors.set(this.mapIssues(parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message }))));
        return;
      }
      this.result.set(await this.api.create(parsed.data));
      // PIN faqat shu yerda ko'rinadi: tasodifan (Esc/fon) yopilmasin.
      this.ref.disableClose = true;
      // Dialog qanday yopilishidan qat'i nazar ro'yxat yangilanadi.
      this.quick.created.update((n) => n + 1);
    } catch (err) {
      const e = toApiError(err);
      if (e.code === 'SLUG_TAKEN') this.slugState.set('taken');
      if (e.code === 'VALIDATION_ERROR') this.errors.set(this.mapIssues(e.body?.issues ?? []));
      this.error.set(errorKey(e.code));
    } finally {
      this.busy.set(false);
    }
  }

  /** Sxema yo'llarini dialog maydonlariga bog'laymiz. */
  private mapIssues(issues: { path: string; code: string; message: string }[]): Map<string, string> {
    const fields: Record<string, string> = {
      customerName: 'customerName',
      customerPhone: 'customerPhone',
      slug: 'slug',
      'config.couple.groom.firstName.uz': 'groom',
      'config.couple.bride.firstName.uz': 'bride',
      'config.events.0.startsAt': 'date',
    };
    const map = new Map<string, string>();
    for (const issue of issues) {
      const field = fields[issue.path];
      if (field && !map.has(field)) map.set(field, issueKey(issue.code, issue.message));
      if (issue.path === 'slug') this.slugState.set('invalid');
    }
    return map;
  }

  protected shareText(r: CreateInvitationResult): string {
    return this.i18n.translate('panel.access.shareMessage', {
      names: r.invitation.coupleNames,
      url: r.invitation.publicUrl,
      adminUrl: r.access.adminUrl,
      pin: r.access.pin,
    });
  }

  protected async openEditor(r: CreateInvitationResult): Promise<void> {
    this.ref.close(r);
    await this.router.navigate(['/panel/i', r.invitation.id]);
  }

  protected async openFullForm(): Promise<void> {
    this.ref.close();
    await this.router.navigateByUrl('/panel/new');
  }
}
