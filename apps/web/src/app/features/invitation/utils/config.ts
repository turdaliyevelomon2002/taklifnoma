import type { EventItem, InvitationConfig, Locale } from '@taklifnoma/shared';
import { localize } from '../../../core/i18n/localize.pipe';

/**
 * Eslatma: bu yerda @taklifnoma/shared'dan faqat TIPLAR import qilinadi.
 * Runtime funksiyalar Zod'ni ham olib kiradi va mehmon sahifasi bundle'ini kattalashtiradi.
 */

export function primaryEvent(config: InvitationConfig): EventItem {
  return config.events.find((e) => e.isPrimary) ?? config.events[0]!;
}

/** Juftlik ismlari config'dagi tartibda: [birinchi, ikkinchi]. */
export function coupleNames(config: InvitationConfig, lang: Locale): [string, string] {
  const groom = localize(config.couple.groom.firstName, lang);
  const bride = localize(config.couple.bride.firstName, lang);
  return config.couple.order === 'bride-first' ? [bride, groom] : [groom, bride];
}
