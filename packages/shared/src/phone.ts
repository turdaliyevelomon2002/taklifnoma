import { z } from 'zod';
import { normalizeUzPhone } from './phone-core';

export { formatUzPhone, normalizeUzPhone } from './phone-core';

export const uzPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .transform((value, ctx) => {
    const normalized = normalizeUzPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_phone' });
      return z.NEVER;
    }
    return normalized;
  });
