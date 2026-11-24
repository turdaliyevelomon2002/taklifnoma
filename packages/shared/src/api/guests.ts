import { z } from 'zod';
import { LOCALES, type Locale } from '../enums';

/** Mehmonlar ro'yxati (juftlik paneli va keyinchalik owner paneli uchun umumiy). */
export const GUEST_FILTERS = ['all', 'attending', 'declined'] as const;
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

export interface GuestView {
  id: string;
  name: string;
  /** Normallashtirilgan: +998901234567 */
  phone: string | null;
  attending: boolean;
  guestCount: number;
  wish: string | null;
  wishHidden: boolean;
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

export const wishVisibilitySchema = z.object({ hidden: z.boolean() });
export type WishVisibilityInput = z.infer<typeof wishVisibilitySchema>;
