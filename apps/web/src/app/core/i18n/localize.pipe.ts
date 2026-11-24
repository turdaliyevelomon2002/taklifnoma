import { Pipe, PipeTransform } from '@angular/core';
import type { LocalizedText, Locale } from '@taklifnoma/shared';

/** Juftlik kiritgan ko'p tilli matn: tanlangan til bo'lmasa o'zbekchasi ko'rsatiladi. */
export function localize(text: LocalizedText | null | undefined, lang: Locale): string {
  if (!text) return '';
  return (lang !== 'uz' ? text[lang] : undefined) || text.uz;
}

/**
 * Foydalanish: {{ config.greeting | loc: lang() }}
 * Til argument sifatida beriladi, shuning uchun pipe "pure" va arzon.
 */
@Pipe({ name: 'loc' })
export class LocalizePipe implements PipeTransform {
  transform(text: LocalizedText | null | undefined, lang: Locale): string {
    return localize(text, lang);
  }
}
