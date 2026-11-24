import type { Type } from '@angular/core';
import type { TemplateKey } from '@taklifnoma/shared/enums';
import type { InvitationTemplateBase } from './template-base';

export interface TemplateDefinition {
  key: TemplateKey;
  /** Shablon shriftlari (Google Fonts CSS). SSR'da <head> ga qo'shiladi. */
  fonts: string[];
  /** Brauzer paneli rangi (mobil). */
  themeColor: string;
  /** Lazy import: har bir shablon alohida chunk, mehmon faqat o'z shablonini yuklaydi. */
  load: () => Promise<Type<InvitationTemplateBase>>;
}

const REGISTRY: Record<TemplateKey, TemplateDefinition> = {
  'classic-gold': {
    key: 'classic-gold',
    fonts: [
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Great+Vibes&display=swap',
    ],
    themeColor: '#f8f3ea',
    load: () => import('./classic-gold/classic-gold.template').then((m) => m.ClassicGoldTemplate),
  },
  'minimal-white': {
    key: 'minimal-white',
    fonts: [
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap',
    ],
    themeColor: '#ffffff',
    load: () => import('./minimal-white/minimal-white.template').then((m) => m.MinimalWhiteTemplate),
  },
  'national-pattern': {
    key: 'national-pattern',
    fonts: [
      'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Marck+Script&family=Philosopher:wght@400;700&display=swap',
    ],
    themeColor: '#13284f',
    load: () =>
      import('./national-pattern/national-pattern.template').then((m) => m.NationalPatternTemplate),
  },
};

const FALLBACK: TemplateKey = 'classic-gold';

/** Noma'lum shablon kaliti (eski ma'lumot) uchun "Klassik oltin" ishlatiladi. */
export function getTemplate(key: TemplateKey): TemplateDefinition {
  return REGISTRY[key] ?? REGISTRY[FALLBACK];
}
