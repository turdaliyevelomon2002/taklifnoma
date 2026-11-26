import { z } from 'zod';
import { LOCALES } from './enums';
import { uzPhoneSchema } from './phone';

/**
 * InvitationConfig: taklifnomaning barcha MATN va SOZLAMA ma'lumotlari.
 * Shablon kodi o'zgarmaydi, faqat shu config o'zgaradi.
 *
 * Media (rasm, musiqa) config ichida saqlanmaydi: ular MediaAsset jadvalida turadi va
 * public API ularni URL'larga aylantirib beradi. Shunday qilib eskirgan havola qolmaydi
 * va storage/CDN domenini bemalol o'zgartirish mumkin.
 */

export const CONFIG_VERSION = 1 as const;

const localeSchema = z.enum(LOCALES);

/** Bo'sh satrni undefined'ga aylantiradi (formalardan "" kelishi mumkin). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Juftlik kiritadigan matn: uz majburiy, ru ixtiyoriy (bo'lmasa uz ko'rsatiladi). */
export const localizedText = (max: number) =>
  z.object({
    uz: z.string().trim().min(1).max(max),
    ru: optionalText(max),
  });

export type LocalizedText = z.infer<ReturnType<typeof localizedText>>;

const isoDateTime = z.string().datetime({ offset: true });

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const personSchema = z.object({
  firstName: localizedText(50),
  lastName: localizedText(50).optional(),
  /** Masalan: "Karimovlar oilasining o'g'li". */
  parents: localizedText(150).optional(),
});

export const venueSchema = z.object({
  name: localizedText(120),
  address: localizedText(250),
  location: geoPointSchema,
  /** Yandex xaritadagi tashkilot ID'si: bo'lsa, xaritada to'yxona kartochkasi ochiladi. */
  yandexOrgId: z
    .string()
    .trim()
    .regex(/^\d{1,20}$/)
    .optional(),
  phone: uzPhoneSchema.optional(),
});

/**
 * Qoralama uchun to'yxona: tezkor yaratishda nom, manzil va lokatsiya hali ma'lum emas.
 * Chop etishda (status ACTIVE) to'liq venueSchema bilan qayta tekshiriladi.
 */
export const draftVenueSchema = venueSchema.partial({ name: true, address: true, location: true });

const makeEventItemSchema = <V extends typeof venueSchema | typeof draftVenueSchema>(venue: V) =>
  z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    /** Masalan: "Fotiha to'yi", "Nikoh", "Nahorgi osh", "To'y". */
    title: localizedText(80),
    startsAt: isoDateTime,
    endsAt: isoDateTime.optional(),
    venue,
    /** Hisoblagich va asosiy sana shu tadbirga qarab hisoblanadi. */
    isPrimary: z.boolean(),
  })
  .refine((e) => !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), {
    message: 'ends_before_start',
    path: ['endsAt'],
  });

export const eventItemSchema = makeEventItemSchema(venueSchema);
export const draftEventItemSchema = makeEventItemSchema(draftVenueSchema);

export const rsvpConfigSchema = z.object({
  /** Shu vaqtdan keyin forma yopiladi. */
  deadline: isoDateTime.optional(),
  maxGuestsPerReply: z.number().int().min(1).max(20).default(5),
  askPhone: z.boolean().default(true),
  askWish: z.boolean().default(true),
  /** Tilaklar juftlik tasdiqlagandan keyingina devorda ko'rinadi. Eski config'larda yo'q: yoqiq deb hisoblanadi. */
  moderateWishes: z.boolean().default(true),
  /**
   * Javob va tilak faqat Telegram Mini App orqali (mehmon Telegram akkaunti bilan aniqlanadi).
   * Sahifaning o'zi hammaga ochiq qoladi.
   */
  telegramOnly: z.boolean().default(false),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeOverridesSchema = z.object({
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
});

export const seoConfigSchema = z.object({
  /** Bo'lmasa, juftlik ismlaridan avtomatik yasaladi. */
  title: localizedText(90).optional(),
  description: localizedText(200).optional(),
});

const makeConfigSchema = <E extends typeof eventItemSchema | typeof draftEventItemSchema>(event: E) =>
  z
  .object({
    version: z.literal(CONFIG_VERSION),
    locales: z.array(localeSchema).min(1).max(LOCALES.length),
    defaultLocale: localeSchema,
    timezone: z.string().min(1).max(64).default('Asia/Tashkent'),

    couple: z.object({
      groom: personSchema,
      bride: personSchema,
      order: z.enum(['groom-first', 'bride-first']).default('groom-first'),
    }),

    greeting: localizedText(1000).optional(),
    closingText: localizedText(500).optional(),
    hashtag: z
      .string()
      .trim()
      .regex(/^#?[\p{L}\p{N}_]{1,40}$/u)
      .optional(),

    events: z.array(event).min(1).max(10),

    musicTitle: optionalText(100),
    rsvp: rsvpConfigSchema,
    theme: themeOverridesSchema.optional(),
    seo: seoConfigSchema.optional(),
  })
  .superRefine((cfg, ctx) => {
    if (new Set(cfg.locales).size !== cfg.locales.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locales'], message: 'duplicate_locale' });
    }
    if (!cfg.locales.includes('uz')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locales'], message: 'uz_required' });
    }
    if (!cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultLocale'],
        message: 'default_locale_not_enabled',
      });
    }
    if (!isValidTimeZone(cfg.timezone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timezone'], message: 'invalid_timezone' });
    }
    const primaryCount = cfg.events.filter((e) => e.isPrimary).length;
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['events'],
        message: 'exactly_one_primary_event',
      });
    }
    const ids = cfg.events.map((e) => e.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events'], message: 'duplicate_event_id' });
    }
  });

/** To'liq (chop etishga tayyor) config. Ommaviy sahifa faqat shunday config bilan ochiladi. */
export const invitationConfigSchema = makeConfigSchema(eventItemSchema);
/** Qoralama: to'yxona ma'lumotlari hali to'liq bo'lmasligi mumkin. */
export const invitationDraftConfigSchema = makeConfigSchema(draftEventItemSchema);

export type InvitationConfig = z.infer<typeof invitationConfigSchema>;
/** Formalardan keladigan (transform'gacha bo'lgan) shakl. */
export type InvitationConfigInput = z.input<typeof invitationConfigSchema>;
export type InvitationDraftConfig = z.infer<typeof invitationDraftConfigSchema>;
export type InvitationDraftConfigInput = z.input<typeof invitationDraftConfigSchema>;
export type EventItem = z.infer<typeof eventItemSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type DraftVenue = z.infer<typeof draftVenueSchema>;
export type Person = z.infer<typeof personSchema>;
export type GeoPoint = z.infer<typeof geoPointSchema>;
export type RsvpConfig = z.infer<typeof rsvpConfigSchema>;
export type ThemeOverrides = z.infer<typeof themeOverridesSchema>;
export type SeoConfig = z.infer<typeof seoConfigSchema>;

export function getPrimaryEvent<T extends { isPrimary: boolean }>(config: { events: T[] }): T {
  const primary = config.events.find((e) => e.isPrimary) ?? config.events[0];
  if (!primary) throw new Error('Invitation config has no events');
  return primary;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tilaklarni oldindan tekshirish yoqiqmi. DB'dagi eski config'larda maydon bo'lmaydi
 * (Zod default'i faqat parse qilinganda ishlaydi), shuning uchun "false emas" = yoqiq.
 */
export function wishModerationEnabled(rsvp: { moderateWishes?: boolean } | undefined): boolean {
  return rsvp?.moderateWishes !== false;
}
