/**
 * Bosh sahifadagi aloqa ma'lumotlari. O'zingiznikini yozing:
 *  - telegram: username, @ belgisisiz (masalan: 'taklifnoma_uz')
 *  - phone: +998XXXXXXXXX
 * Bo'sh qolsa, tegishli tugma ko'rsatilmaydi va "Buyurtma berish" demo sahifaga olib boradi.
 */
export const HOME_CONTACT = {
  telegram: '',
  phone: '',
} as const;

/** Bosh sahifadagi "Jonli demo" havolasi (seed'dagi namunaviy taklifnoma). */
export const DEMO_SLUG = 'ali-madina';

/**
 * Narxlar bo'limidagi imkoniyatlar jadvali. Manba: packages/shared/src/features.ts (PACKAGE_FEATURES).
 * Bosh sahifa bundle'iga Zod tushmasligi uchun bu yerda faqat ko'rinish uchun takrorlangan.
 */
export const PRICING_ROWS = [
  { key: 'countdown', basic: true, standard: true, premium: true },
  { key: 'map', basic: true, standard: true, premium: true },
  { key: 'rsvp', basic: true, standard: true, premium: true },
  { key: 'music', basic: false, standard: true, premium: true },
  { key: 'gallery12', basic: false, standard: true, premium: false },
  { key: 'gallery30', basic: false, standard: false, premium: true },
  { key: 'wishes', basic: false, standard: true, premium: true },
  { key: 'russian', basic: false, standard: true, premium: true },
  { key: 'telegram', basic: false, standard: true, premium: true },
  { key: 'excel', basic: false, standard: true, premium: true },
] as const;
