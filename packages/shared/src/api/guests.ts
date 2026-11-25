import { z } from 'zod';
import { LOCALES, type Locale, type WishStatus } from '../enums';

/** Mehmonlar ro'yxati (juftlik paneli va keyinchalik owner paneli uchun umumiy). */
export const GUEST_FILTERS = ['all', 'attending', 'declined', 'pendingWishes'] as const;
export type GuestFilter = (typeof GUEST_FILTERS)[number];

export const GUEST_SORTS = ['newest', 'oldest', 'name'] as const;
export type GuestSort = (typeof GUEST_SORTS)[number];

export const GUEST_PAGE_SIZE_MAX = 100;

export const guestListQuerySchema = z.object({
  filter: z.enum(GUEST_FILTERS).default('all'),
  sort: z.enum(GUEST_SORTS).default('newest'),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(GUEST_PAGE_SIZE_MAX).default(30),
});
export type GuestListQuery = z.input<typeof guestListQuerySchema>;
export type GuestListQueryParsed = z.output<typeof guestListQuerySchema>;

export const guestExportQuerySchema = z.object({
  lang: z.enum(LOCALES).default('uz'),
});

export interface GuestWish {
  id: string;
  text: string;
  status: WishStatus;
  /** So'kinish filtri matnda yoki muallif ismida shubhali so'z topgan. */
  flagged: boolean;
  createdAt: string;
}

export interface GuestView {
  id: string;
  name: string;
  /** Normallashtirilgan: +998901234567 */
  phone: string | null;
  attending: boolean;
  guestCount: number;
  /** Shu mehmon yozgan tilaklar (eskisi avval). */
  wishes: GuestWish[];
  /** Javob Telegram Mini App orqali berilgan bo'lsa. */
  telegram: { id: string; username: string | null } | null;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface GuestPage {
  items: GuestView[];
  /** Filtr va qidiruvdan keyingi jami. */
  total: number;
  page: number;
  pageSize: number;
}

/** Juftlik/owner tilakni tasdiqlaydi yoki yashiradi (PENDING ga qaytarib bo'lmaydi). */
export const wishStatusSchema = z.object({ status: z.enum(['APPROVED', 'HIDDEN']) });
export type WishStatusInput = z.infer<typeof wishStatusSchema>;
