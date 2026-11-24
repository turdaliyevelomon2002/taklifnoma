import { z } from 'zod';
import { INVITATION_STATUSES, PACKAGE_TYPES, TEMPLATE_KEYS } from '../enums';
import type { InvitationStatus, PackageType, TemplateKey } from '../enums';
import { featureOverridesSchema } from '../features';
import type { FeatureFlags, FeatureOverrides } from '../features';
import { invitationConfigSchema } from '../invitation-config';
import type { InvitationConfig } from '../invitation-config';
import { uzPhoneSchema } from '../phone';
import { slugSchema } from '../slug';
import type { MediaView } from './media';

export const createInvitationSchema = z.object({
  slug: slugSchema,
  templateKey: z.enum(TEMPLATE_KEYS),
  package: z.enum(PACKAGE_TYPES).default('BASIC'),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: uzPhoneSchema,
  price: z.number().int().min(0).max(1_000_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
  config: invitationConfigSchema,
  featureOverrides: featureOverridesSchema.optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateInvitationSchema = z
  .object({
    slug: slugSchema,
    templateKey: z.enum(TEMPLATE_KEYS),
    package: z.enum(PACKAGE_TYPES),
    customerName: z.string().trim().min(2).max(100),
    customerPhone: uzPhoneSchema,
    price: z.number().int().min(0).max(1_000_000_000).nullable(),
    paidAt: z.string().datetime({ offset: true }).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    config: invitationConfigSchema,
    featureOverrides: featureOverridesSchema.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update');
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(INVITATION_STATUSES),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const listInvitationsQuerySchema = z.object({
  status: z.enum(INVITATION_STATUSES).optional(),
  package: z.enum(PACKAGE_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['createdAt', 'eventDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;

export const slugCheckQuerySchema = z.object({ slug: z.string().max(100) });

export interface RsvpStats {
  /** Jami javoblar soni. */
  replies: number;
  /** "Keladi" deb javob berganlar soni. */
  attendingReplies: number;
  /** Keladigan mehmonlar soni (guestCount yig'indisi). */
  attendingGuests: number;
  notAttendingReplies: number;
}

export interface InvitationListItem {
  id: string;
  slug: string;
  templateKey: TemplateKey;
  package: PackageType;
  status: InvitationStatus;
  /** "Ali & Madina" (o'zbekcha). */
  coupleNames: string;
  customerName: string;
  customerPhone: string;
  eventDate: string;
  price: number | null;
  paidAt: string | null;
  createdAt: string;
  stats: RsvpStats;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface InvitationDetail extends InvitationListItem {
  config: InvitationConfig;
  featureOverrides: FeatureOverrides | null;
  features: FeatureFlags;
  notes: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  coupleTelegramLinked: boolean;
  /** Juftlik botga ulanishi uchun deep link (bot sozlanmagan bo'lsa null). */
  telegramLinkUrl: string | null;
  pinEnabled: boolean;
  media: MediaView[];
  publicUrl: string;
}

/** Faqat yaratishda yoki qayta generatsiya qilinganda bir marta qaytariladi. */
export interface CoupleAccessCredentials {
  adminUrl: string;
  pin: string;
}

export interface CreateInvitationResult {
  invitation: InvitationDetail;
  access: CoupleAccessCredentials;
}
