import { z } from 'zod';
import { PIN_LENGTH } from '../enums';
import { slugSchema } from '../slug';

export const ownerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});
export type OwnerLoginInput = z.infer<typeof ownerLoginSchema>;

export interface OwnerProfile {
  id: string;
  email: string;
  telegramLinked: boolean;
}

export const coupleTokenLoginSchema = z.object({
  slug: slugSchema,
  token: z.string().trim().min(20).max(200),
});
export type CoupleTokenLoginInput = z.infer<typeof coupleTokenLoginSchema>;

export const couplePinLoginSchema = z.object({
  slug: slugSchema,
  pin: z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`)),
});
export type CouplePinLoginInput = z.infer<typeof couplePinLoginSchema>;
