import type { InvitationConfig, Locale, LocalizedText } from '@taklifnoma/shared';

/** Ko'p tilli matn: so'ralgan til bo'lmasa o'zbekchasi. */
export function localize(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return '';
  return (locale !== 'uz' ? text[locale] : undefined) || text.uz;
}

/** "Ali & Madina" (config.couple.order bo'yicha tartib). */
export function coupleNames(config: InvitationConfig, locale: Locale): string {
  const groom = localize(config.couple.groom.firstName, locale);
  const bride = localize(config.couple.bride.firstName, locale);
  return config.couple.order === 'bride-first' ? `${bride} & ${groom}` : `${groom} & ${bride}`;
}
