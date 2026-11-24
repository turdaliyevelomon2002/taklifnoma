import { Injectable } from '@nestjs/common';
import { MEDIA_LIMITS, type ImageVariant } from '@taklifnoma/shared';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { ApiError } from '../common/api-error';

export interface ProcessedImage {
  /** Variant nomi -> fayl */
  files: Array<{ name: ImageVariant | 'og'; buffer: Buffer; mime: string; ext: string }>;
  width: number;
  height: number;
}

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif', 'gif']);

/**
 * Rasmni qayta kodlaydi: EXIF bo'yicha buradi, metadata'ni (GPS va boshqalar) tozalaydi,
 * mobil uchun webp variantlarini yasaydi. Qayta kodlash zararli payload'larni ham yo'q qiladi.
 */
@Injectable()
export class ImageProcessor {
  private async validate(input: Buffer): Promise<Metadata> {
    try {
      const meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
      if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
        throw new Error('unsupported');
      }
      return meta;
    } catch {
      throw ApiError.badRequest('UNSUPPORTED_FILE_TYPE');
    }
  }

  private base(input: Buffer): Sharp {
    return sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate();
  }

  /** Galereya/cover: sm/md/lg webp. withOg=true bo'lsa, 1200x630 OG jpeg ham yasaladi. */
  async responsive(input: Buffer, withOg: boolean): Promise<ProcessedImage> {
    await this.validate(input);
    const files: ProcessedImage['files'] = [];
    let width = 0;
    let height = 0;

    for (const [name, w] of Object.entries(MEDIA_LIMITS.imageWidths) as [ImageVariant, number][]) {
      const { data, info } = await this.base(input)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      files.push({ name, buffer: data, mime: 'image/webp', ext: 'webp' });
      if (name === 'lg') {
        width = info.width;
        height = info.height;
      }
    }

    if (withOg) files.push(await this.ogFile(input));
    return { files, width, height };
  }

  /** Telegram/Facebook preview: 1200x630, jpeg (eng keng qo'llab-quvvatlanadigan format). */
  async og(input: Buffer): Promise<ProcessedImage> {
    await this.validate(input);
    const file = await this.ogFile(input);
    return { files: [file], width: MEDIA_LIMITS.og.width, height: MEDIA_LIMITS.og.height };
  }

  private async ogFile(input: Buffer): Promise<ProcessedImage['files'][number]> {
    const buffer = await this.base(input)
      .resize({
        width: MEDIA_LIMITS.og.width,
        height: MEDIA_LIMITS.og.height,
        fit: 'cover',
        position: sharp.strategy.attention,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { name: 'og', buffer, mime: 'image/jpeg', ext: 'jpg' };
  }
}
