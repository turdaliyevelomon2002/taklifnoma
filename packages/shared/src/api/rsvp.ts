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
  /** Bitta mehmon (javob) yozishi mumkin bo'lgan tilaklar soni. */
  wishesPerGuest: 10,
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
  /** Telegram Mini App ichida: Telegram.WebApp.initData (serverda imzosi tekshiriladi). */
  tgInitData: z.string().max(4096).optional(),
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
  /**
   * Tilak yozilgan bo'lsa: uning ID va holati. PENDING bo'lsa mehmon uni faqat o'z brauzerida
   * "tasdiqlanishi kutilmoqda" belgisi bilan ko'radi.
   */
  wish?: OwnWishView;
  /**
   * Brauzerdagi mehmon keyin yana tilak qo'shishi uchun imzolangan kalit (shu javobga bog'langan).
   * Telegram orqali kirganlarga kerak emas: ular akkaunt bo'yicha taniladi.
   */
  guestToken?: string;
}

/** Mehmonning o'z tilagi. Yashirilgan tilak ham unga PENDING bo'lib ko'rinadi. */
export interface OwnWishView {
  id: string;
  text: string;
  status: 'PENDING' | 'APPROVED';
  createdAt: string;
}

/** Javob bergan mehmon yana tilak qo'shadi. Muallif: Telegram (tgInitData) yoki guestToken. */
export const wishAddSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2)
    .max(RSVP_LIMITS.wishMax)
    .transform((v) => v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '')),
  tgInitData: z.string().max(4096).optional(),
  guestToken: z.string().max(300).optional(),
});
export type WishAddInput = z.input<typeof wishAddSchema>;
export type WishAddParsed = z.infer<typeof wishAddSchema>;

export const telegramSessionSchema = z.object({ initData: z.string().min(10).max(4096) });
export type TelegramSessionInput = z.infer<typeof telegramSessionSchema>;

/** Mini App ochilganda: Telegram foydalanuvchisi va (bo'lsa) uning avvalgi javobi. */
export interface TelegramGuestSession {
  user: { id: string; name: string; username: string | null };
  reply: {
    name: string;
    phone: string | null;
    attending: boolean;
    guestCount: number;
    wishes: OwnWishView[];
    createdAt: string;
  } | null;
}

export interface PublicWish {
  id: string;
  name: string;
  wish: string;
  createdAt: string;
}
