import { z } from 'zod';
import { LOCALES } from '../enums';

export const RSVP_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  wishMax: 1000,
  /** Forma ochilgandan keyin shuncha vaqt o'tmasdan yuborilsa: bot. */
  minFillMs: 3_000,
  /** Forma tokenining amal qilish muddati. */
  tokenTtlMs: 12 * 3600_000,
  /** Bitta IP'dan bitta taklifnomaga bir kunda maksimal javoblar. */
  perIpPerDay: 10,
} as const;

/** Ko'rinmas "tuzoq" maydon nomi: odam uni to'ldirmaydi, botlar esa to'ldiradi. */
export const RSVP_HONEYPOT_FIELD = 'website';

/**
 * Mehmon yuboradigan RSVP. Telefon va tilak config'ga qarab serverda qo'shimcha tekshiriladi
 * (askPhone/askWish, maxGuestsPerReply).
 */
export const rsvpSubmitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(RSVP_LIMITS.nameMin)
    .max(RSVP_LIMITS.nameMax)
    // Boshqaruv belgilari va HTML teglari kerak emas.
    .refine((v) => !/[<>\u0000-\u001f]/.test(v), 'invalid_characters'),
  phone: z.string().trim().max(30).optional(),
  attending: z.boolean(),
  guestCount: z.number().int().min(0).max(20),
  wish: z
    .string()
    .trim()
    .max(RSVP_LIMITS.wishMax)
    .optional()
    .transform((v) => (v ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '') : undefined)),
  locale: z.enum(LOCALES),
  formToken: z.string().min(10).max(300),
  [RSVP_HONEYPOT_FIELD]: z.string().max(500).optional(),
});
export type RsvpSubmitInput = z.input<typeof rsvpSubmitSchema>;
export type RsvpSubmitParsed = z.infer<typeof rsvpSubmitSchema>;

export interface RsvpFormToken {
  token: string;
}

export interface RsvpSubmitResult {
  /** created: yangi javob; updated: shu raqamdan oldingi javob yangilandi. */
  status: 'created' | 'updated';
}

export interface PublicWish {
  id: string;
  name: string;
  wish: string;
  createdAt: string;
}
