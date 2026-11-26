import type { FeatureFlags, InvitationConfig } from '@taklifnoma/shared';
import type { Locale, TemplateKey } from '@taklifnoma/shared/enums';

/**
 * Muharrir (ota oyna) va jonli preview (iframe) orasidagi postMessage kontrakti.
 * Ikkalasi bir origin'da: xabarlar faqat shu origin va kutilgan oynadan qabul qilinadi.
 */
export interface PreviewUpdate {
  type: 'tk-preview:update';
  templateKey: TemplateKey;
  /** Saqlanmagan, lekin qoralama sxemasidan o'tgan config. */
  config: InvitationConfig;
  features: FeatureFlags;
  locale: Locale;
}

export interface PreviewReady {
  type: 'tk-preview:ready';
}

export function isPreviewMessage<T extends PreviewUpdate | PreviewReady>(data: unknown, type: T['type']): data is T {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === type;
}
