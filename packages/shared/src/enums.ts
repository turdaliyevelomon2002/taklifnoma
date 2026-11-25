/**
 * Prisma enum'lari bilan bir xil qiymatlar. Frontend Prisma'ni import qilmasligi uchun
 * bu yerda alohida e'lon qilingan. O'zgartirsangiz schema.prisma'ni ham yangilang.
 */

export const LOCALES = ['uz', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';

export const PACKAGE_TYPES = ['BASIC', 'STANDARD', 'PREMIUM'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const INVITATION_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const MEDIA_KINDS = ['COVER', 'GALLERY', 'MUSIC', 'OG_IMAGE'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Bitta taklifnomada faqat bittadan bo'lishi mumkin bo'lgan media turlari. */
export const SINGLE_MEDIA_KINDS: readonly MediaKind[] = ['COVER', 'MUSIC', 'OG_IMAGE'];

/** Kod ichida ro'yxatdan o'tgan shablonlar. Frontend registry bilan mos bo'lishi shart. */
/** Tilak holati: PENDING (tasdiq kutmoqda), APPROVED (devorda ko'rinadi), HIDDEN (yashirilgan). */
export const WISH_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];

export const TEMPLATE_KEYS = ['classic-gold', 'minimal-white', 'national-pattern'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Juftlik paneli PIN kodi uzunligi. */
export const PIN_LENGTH = 6;
