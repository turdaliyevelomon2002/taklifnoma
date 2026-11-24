import type { TemplateKey } from '../enums';
import type { FeatureFlags } from '../features';
import type { InvitationConfig } from '../invitation-config';
import type { MediaView } from './media';

/**
 * Mehmon sahifasi uchun ma'lumot. Paket funksiyalari server tomonda qo'llangan
 * (masalan, music o'chiq bo'lsa media.music umuman qaytmaydi).
 */
export interface PublicInvitation {
  slug: string;
  templateKey: TemplateKey;
  config: InvitationConfig;
  features: FeatureFlags;
  media: {
    cover?: MediaView;
    gallery: MediaView[];
    music?: MediaView;
  };
  seo: {
    /** Telegram/OG preview uchun absolyut URL (1200x630). */
    ogImageUrl?: string;
    canonicalUrl: string;
  };
  /** RSVP hali qabul qilinadimi (status + deadline + feature). */
  rsvpOpen: boolean;
}
