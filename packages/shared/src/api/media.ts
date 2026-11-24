import { z } from 'zod';
import type { MediaKind } from '../enums';

/** URL'dagi media turi: /media/cover, /media/gallery, /media/music, /media/og-image */
export const MEDIA_KIND_PARAMS = {
  cover: 'COVER',
  gallery: 'GALLERY',
  music: 'MUSIC',
  'og-image': 'OG_IMAGE',
} as const satisfies Record<string, MediaKind>;

export type MediaKindParam = keyof typeof MEDIA_KIND_PARAMS;

export const mediaKindParamSchema = z
  .enum(Object.keys(MEDIA_KIND_PARAMS) as [MediaKindParam, ...MediaKindParam[]])
  .transform((v) => MEDIA_KIND_PARAMS[v]);

export const reorderMediaSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>;

export const MEDIA_LIMITS = {
  imageMaxBytes: 15 * 1024 * 1024,
  audioMaxBytes: 12 * 1024 * 1024,
  /** Rasm variantlari kengligi (px). */
  imageWidths: { sm: 480, md: 960, lg: 1600 },
  og: { width: 1200, height: 630 },
} as const;

export type ImageVariant = keyof typeof MEDIA_LIMITS.imageWidths;

export interface MediaView {
  id: string;
  kind: MediaKind;
  /** Asosiy URL (rasm uchun lg varianti, musiqa uchun fayl). */
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  /** Rasm uchun srcset: { sm, md, lg } */
  variants?: Partial<Record<ImageVariant, string>>;
  /** Cover rasmidan avtomatik yasalgan 1200x630 OG rasm. */
  ogUrl?: string;
  sortOrder: number;
}
