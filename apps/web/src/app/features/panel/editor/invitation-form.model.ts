import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import {
  CONFIG_VERSION,
  createInvitationSchema,
  type ApiErrorIssue,
  type CreateInvitationInput,
  type FeatureFlags,
  type FeatureOverrides,
  type InvitationDraftConfigInput,
  type InvitationDetail,
  type LocalizedText,
  type PackageType,
  type Person,
  type TemplateKey,
} from '@taklifnoma/shared';
import { formatUzPhone } from '@taklifnoma/shared/phone';
import { isoToZonedInput, zonedInputToIso } from '../../../shared/date/zoned-input';
import { parseLocation } from '../utils/geo';

export const DEFAULT_TIMEZONE = 'Asia/Tashkent';

/** Owner paketdan tashqari o'zgartira oladigan imkoniyatlar (galleryLimit alohida). */
export const BOOLEAN_FEATURES = [
  'countdown',
  'map',
  'rsvp',
  'music',
  'gallery',
  'wishesWall',
  'multiLanguage',
  'excelExport',
  'telegramNotify',
] as const satisfies readonly (keyof FeatureFlags)[];
export type BooleanFeature = (typeof BOOLEAN_FEATURES)[number];
export type OverrideMode = 'package' | 'on' | 'off';

// --- Forma tuzilmasi ---------------------------------------------------------

export type LocalizedGroup = FormGroup<{ uz: FormControl<string>; ru: FormControl<string> }>;

export type PersonGroup = FormGroup<{
  firstName: LocalizedGroup;
  lastName: LocalizedGroup;
  parents: LocalizedGroup;
}>;

export type EventGroup = FormGroup<{
  id: FormControl<string>;
  title: LocalizedGroup;
  startsAt: FormControl<string>;
  endsAt: FormControl<string>;
  venueName: LocalizedGroup;
  address: LocalizedGroup;
  /** "41.31, 69.24" yoki xarita havolasi. */
  location: FormControl<string>;
  yandexOrgId: FormControl<string>;
  phone: FormControl<string>;
  isPrimary: FormControl<boolean>;
}>;

export function buildInvitationForm(fb: NonNullableFormBuilder) {
  const localized = () => fb.group({ uz: [''], ru: [''] });
  const person = () => fb.group({ firstName: localized(), lastName: localized(), parents: localized() });

  return fb.group({
    order: fb.group({
      customerName: [''],
      customerPhone: [''],
      slug: [''],
      templateKey: fb.control<TemplateKey>('classic-gold'),
      package: fb.control<PackageType>('STANDARD'),
      price: fb.control<number | null>(null),
      /** "YYYY-MM-DD" yoki bo'sh. */
      paidAt: [''],
      notes: [''],
    }),
    couple: fb.group({
      groom: person(),
      bride: person(),
      order: fb.control<'groom-first' | 'bride-first'>('groom-first'),
    }),
    settings: fb.group({
      ru: [true],
      defaultLocale: fb.control<'uz' | 'ru'>('uz'),
      timezone: [DEFAULT_TIMEZONE],
    }),
    texts: fb.group({
      greeting: localized(),
      closingText: localized(),
      hashtag: [''],
      musicTitle: [''],
    }),
    events: fb.array<EventGroup>([]),
    rsvp: fb.group({
      deadline: [''],
      maxGuestsPerReply: [5],
      askPhone: [true],
      askWish: [true],
      moderateWishes: [true],
      telegramOnly: [false],
    }),
    theme: fb.group({ primaryColor: [''], accentColor: [''] }),
    seo: fb.group({ title: localized(), description: localized() }),
    features: fb.group({
      ...(Object.fromEntries(
        BOOLEAN_FEATURES.map((k) => [k, fb.control<OverrideMode>('package')]),
      ) as Record<BooleanFeature, FormControl<OverrideMode>>),
      galleryLimit: fb.control<number | null>(null),
    }),
  });
}

export type InvitationForm = ReturnType<typeof buildInvitationForm>;

export function buildEventGroup(fb: NonNullableFormBuilder, isPrimary = false): EventGroup {
  const localized = () => fb.group({ uz: [''], ru: [''] });
  return fb.group({
    id: [newEventId()],
    title: localized(),
    startsAt: [''],
    endsAt: [''],
    venueName: localized(),
    address: localized(),
    location: [''],
    yandexOrgId: [''],
    phone: [''],
    isPrimary: [isPrimary],
  });
}

function newEventId(): string {
  return `e-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Detail -> forma ---------------------------------------------------------

function loc(v?: LocalizedText) {
  return { uz: v?.uz ?? '', ru: v?.ru ?? '' };
}

function personValue(p: Person) {
  return { firstName: loc(p.firstName), lastName: loc(p.lastName), parents: loc(p.parents) };
}

export function patchFromDetail(form: InvitationForm, fb: NonNullableFormBuilder, d: InvitationDetail): void {
  const c = d.config;
  const tz = c.timezone;
  form.controls.events.clear();
  for (const e of c.events) {
    const g = buildEventGroup(fb);
    g.setValue(eventValue(e, tz));
    form.controls.events.push(g);
  }

  const overrides = d.featureOverrides ?? {};
  form.patchValue({
    order: {
      customerName: d.customerName,
      customerPhone: formatUzPhone(d.customerPhone),
      slug: d.slug,
      templateKey: d.templateKey,
      package: d.package,
      price: d.price,
      paidAt: d.paidAt ? isoToZonedInput(d.paidAt, tz).slice(0, 10) : '',
      notes: d.notes ?? '',
    },
    couple: { groom: personValue(c.couple.groom), bride: personValue(c.couple.bride), order: c.couple.order },
    settings: { ru: c.locales.includes('ru'), defaultLocale: c.defaultLocale, timezone: tz },
    texts: {
      greeting: loc(c.greeting),
      closingText: loc(c.closingText),
      hashtag: c.hashtag ?? '',
      musicTitle: c.musicTitle ?? '',
    },
    rsvp: {
      deadline: isoToZonedInput(c.rsvp.deadline, tz),
      maxGuestsPerReply: c.rsvp.maxGuestsPerReply,
      askPhone: c.rsvp.askPhone,
      askWish: c.rsvp.askWish,
      // Eski config'larda maydon yo'q: yoqiq deb hisoblanadi.
      moderateWishes: c.rsvp.moderateWishes !== false,
      telegramOnly: c.rsvp.telegramOnly === true,
    },
    theme: { primaryColor: c.theme?.primaryColor ?? '', accentColor: c.theme?.accentColor ?? '' },
    seo: { title: loc(c.seo?.title), description: loc(c.seo?.description) },
    features: {
      ...Object.fromEntries(
        BOOLEAN_FEATURES.map((k) => [k, overrides[k] === undefined ? 'package' : overrides[k] ? 'on' : 'off']),
      ),
      galleryLimit: overrides.galleryLimit ?? null,
    },
  });
}

type DetailEvent = InvitationDetail['config']['events'][number];

function eventValue(e: DetailEvent, tz: string) {
  return {
    id: e.id,
    title: loc(e.title),
    startsAt: isoToZonedInput(e.startsAt, tz),
    endsAt: isoToZonedInput(e.endsAt, tz),
    venueName: loc(e.venue.name),
    address: loc(e.venue.address),
    location: e.venue.location ? `${e.venue.location.lat}, ${e.venue.location.lng}` : '',
    yandexOrgId: e.venue.yandexOrgId ?? '',
    phone: e.venue.phone ? formatUzPhone(e.venue.phone) : '',
    isPrimary: e.isPrimary,
  };
}

// --- Forma -> API ------------------------------------------------------------

type FormValue = ReturnType<InvitationForm['getRawValue']>;

export interface BuildResult {
  input: CreateInvitationInput | null;
  /** path -> i18n kaliti */
  errors: Map<string, string>;
  /** Tekshirilmagan config: jonli preview uchun (u o'zi qoralama sxemasi bilan tekshiradi). */
  config: InvitationDraftConfigInput;
  templateKey: TemplateKey;
}

/** Forma qiymatini API kontraktiga aylantiradi va umumiy Zod sxemasi bilan tekshiradi. */
export function buildInput(v: FormValue): BuildResult {
  const errors = new Map<string, string>();
  const tz = v.settings.timezone.trim() || DEFAULT_TIMEZONE;
  const withRu = v.settings.ru;

  const text = (l: { uz: string; ru: string }) => ({ uz: l.uz, ru: withRu ? l.ru : undefined });
  /** Ixtiyoriy matn: uz ham, ru ham bo'sh bo'lsa butunlay tushirib qoldiriladi. */
  const optional = (l: { uz: string; ru: string }) =>
    l.uz.trim() || (withRu && l.ru.trim()) ? text(l) : undefined;
  const date = (value: string, path: string) => {
    if (!value) return undefined;
    const iso = zonedInputToIso(value, tz);
    if (!iso) errors.set(path, 'panel.validation.invalidFormat');
    return iso ?? undefined;
  };

  const events = v.events.map((e, i) => {
    const path = `config.events.${i}`;
    // Qoralamada lokatsiya bo'sh bo'lishi mumkin (chop etishda server talab qiladi).
    const location = e.location.trim() ? parseLocation(e.location) : undefined;
    if (location === null) errors.set(`${path}.venue.location`, 'panel.validation.invalidLocation');
    return {
      id: e.id,
      title: text(e.title),
      startsAt: date(e.startsAt, `${path}.startsAt`) ?? '',
      endsAt: date(e.endsAt, `${path}.endsAt`),
      venue: {
        name: optional(e.venueName),
        address: optional(e.address),
        location: location ?? undefined,
        yandexOrgId: e.yandexOrgId.trim() || undefined,
        phone: e.phone.trim() || undefined,
      },
      isPrimary: e.isPrimary,
    };
  });

  const person = (p: FormValue['couple']['groom']) => ({
    firstName: text(p.firstName),
    lastName: optional(p.lastName),
    parents: optional(p.parents),
  });

  const config: InvitationDraftConfigInput = {
    version: CONFIG_VERSION,
    locales: withRu ? ['uz', 'ru'] : ['uz'],
    defaultLocale: withRu ? v.settings.defaultLocale : 'uz',
    timezone: tz,
    couple: { groom: person(v.couple.groom), bride: person(v.couple.bride), order: v.couple.order },
    greeting: optional(v.texts.greeting),
    closingText: optional(v.texts.closingText),
    hashtag: v.texts.hashtag.trim() || undefined,
    events,
    musicTitle: v.texts.musicTitle,
    rsvp: {
      deadline: date(v.rsvp.deadline, 'config.rsvp.deadline'),
      maxGuestsPerReply: Number(v.rsvp.maxGuestsPerReply),
      askPhone: v.rsvp.askPhone,
      askWish: v.rsvp.askWish,
      moderateWishes: v.rsvp.moderateWishes,
      telegramOnly: v.rsvp.telegramOnly,
    },
    theme: {
      primaryColor: v.theme.primaryColor || undefined,
      accentColor: v.theme.accentColor || undefined,
    },
    seo: { title: optional(v.seo.title), description: optional(v.seo.description) },
  };

  const overrides: FeatureOverrides = {};
  for (const k of BOOLEAN_FEATURES) {
    const mode = v.features[k];
    if (mode !== 'package') overrides[k] = mode === 'on';
  }
  if (v.features.galleryLimit !== null && String(v.features.galleryLimit) !== '') {
    overrides.galleryLimit = Number(v.features.galleryLimit);
  }

  const raw = {
    slug: v.order.slug,
    templateKey: v.order.templateKey,
    package: v.order.package,
    customerName: v.order.customerName,
    customerPhone: v.order.customerPhone,
    price: v.order.price === null || String(v.order.price) === '' ? undefined : Number(v.order.price),
    notes: v.order.notes.trim() || undefined,
    config,
    featureOverrides: overrides,
  };

  const parsed = createInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (!errors.has(path)) errors.set(path, issueKey(issue.code, issue.message));
    }
  }
  return {
    input: parsed.success && errors.size === 0 ? parsed.data : null,
    errors,
    config,
    templateKey: v.order.templateKey,
  };
}

/** "YYYY-MM-DD" -> ISO (taklifnoma vaqt mintaqasida kun boshi). */
export function paidAtToIso(value: string, tz: string): string | null {
  return value ? zonedInputToIso(`${value}T12:00`, tz) : null;
}

// --- Xato matnlari -----------------------------------------------------------

/** Sxemadagi maxsus xato kodlari: matni panel.validation.<kod> da. */
const CUSTOM_MESSAGES = new Set([
  'exactly_one_primary_event',
  'ends_before_start',
  'uz_required',
  'invalid_timezone',
  'duplicate_event_id',
  'default_locale_not_enabled',
  'invalid_slug',
  'reserved_slug',
  'invalid_phone',
]);

export function issueKey(code: string, message: string): string {
  if (CUSTOM_MESSAGES.has(message)) return `panel.validation.${message}`;
  switch (code) {
    case 'too_small':
    case 'invalid_type':
      return 'panel.validation.required';
    case 'too_big':
      return 'panel.validation.tooLong';
    case 'invalid_format':
    case 'invalid_string':
      return 'panel.validation.invalidFormat';
    default:
      return 'panel.validation.invalid';
  }
}

/** Server qaytargan VALIDATION_ERROR issues -> path xaritasi. */
export function serverIssues(issues: ApiErrorIssue[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const i of issues ?? []) map.set(i.path, issueKey(i.code, i.message));
  return map;
}

