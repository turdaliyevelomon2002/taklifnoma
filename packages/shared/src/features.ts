import { z } from 'zod';
import type { PackageType } from './enums';

export const featureFlagsSchema = z.object({
  countdown: z.boolean(),
  map: z.boolean(),
  rsvp: z.boolean(),
  music: z.boolean(),
  gallery: z.boolean(),
  /** Galereyadagi maksimal rasm soni. Har bir rasm 3 o'lchamda webp sifatida saqlanadi. */
  galleryLimit: z.number().int().min(0).max(60),
  /** Mehmonlar tilaklari taklifnoma sahifasida ko'rinadi. */
  wishesWall: z.boolean(),
  /** Rus tilini yoqish (o'zbek tili doim mavjud). */
  multiLanguage: z.boolean(),
  excelExport: z.boolean(),
  telegramNotify: z.boolean(),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

/** Owner bitta taklifnoma uchun paketdan tashqari istisno belgilashi mumkin. */
export const featureOverridesSchema = featureFlagsSchema.partial().strict();
export type FeatureOverrides = z.infer<typeof featureOverridesSchema>;

export const PACKAGE_FEATURES: Readonly<Record<PackageType, Readonly<FeatureFlags>>> = {
  BASIC: {
    countdown: true,
    map: true,
    rsvp: true,
    music: false,
    gallery: false,
    galleryLimit: 0,
    wishesWall: false,
    multiLanguage: false,
    excelExport: false,
    telegramNotify: false,
  },
  STANDARD: {
    countdown: true,
    map: true,
    rsvp: true,
    music: true,
    gallery: true,
    galleryLimit: 12,
    wishesWall: true,
    multiLanguage: true,
    excelExport: true,
    telegramNotify: true,
  },
  PREMIUM: {
    countdown: true,
    map: true,
    rsvp: true,
    music: true,
    gallery: true,
    galleryLimit: 30,
    wishesWall: true,
    multiLanguage: true,
    excelExport: true,
    telegramNotify: true,
  },
};

export function resolveFeatures(
  pkg: PackageType,
  overrides?: FeatureOverrides | null,
): FeatureFlags {
  const merged: FeatureFlags = { ...PACKAGE_FEATURES[pkg], ...(overrides ?? {}) };
  if (!merged.gallery) merged.galleryLimit = 0;
  if (merged.galleryLimit === 0) merged.gallery = false;
  return merged;
}
