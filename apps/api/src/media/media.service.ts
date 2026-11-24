import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type MediaAsset } from '@prisma/client';
import {
  MEDIA_LIMITS,
  SINGLE_MEDIA_KINDS,
  type MediaKind,
  type MediaView,
} from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import type { MediaVariantKeys } from '../invitations/invitation.presenter';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { detectAudio } from './file-type';
import { ImageProcessor } from './image-processor.service';

interface PreparedUpload {
  storageKey: string;
  variants: MediaVariantKeys | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedKeys: string[];
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageProcessor,
    private readonly presenter: InvitationPresenter,
  ) {}

  async upload(invitationId: string, kind: MediaKind, file?: Express.Multer.File): Promise<MediaView> {
    if (!file?.buffer?.length) throw ApiError.badRequest('FILE_REQUIRED');

    const inv = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, package: true, featureOverrides: true },
    });
    if (!inv) throw ApiError.notFound();

    const features = this.presenter.features(inv);
    if (kind === 'GALLERY' && !features.gallery) throw ApiError.forbidden('FEATURE_DISABLED');
    if (kind === 'MUSIC' && !features.music) throw ApiError.forbidden('FEATURE_DISABLED');

    // Og'ir ish (qayta kodlash, S3 ga yuklash) tranzaksiyadan tashqarida.
    const prepared = await this.prepare(invitationId, kind, file);

    let replaced: MediaAsset[] = [];
    let created: MediaAsset;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // Bitta taklifnoma uchun media yozuvlarini ketma-ket bajaradi (limitni poyga holatidan himoya).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invitationId}))`;

        let sortOrder = 0;
        if (kind === 'GALLERY') {
          const agg = await tx.mediaAsset.aggregate({
            where: { invitationId, kind },
            _count: { _all: true },
            _max: { sortOrder: true },
          });
          if (agg._count._all >= features.galleryLimit) {
            throw ApiError.badRequest('GALLERY_LIMIT_REACHED', { limit: features.galleryLimit });
          }
          sortOrder = (agg._max.sortOrder ?? -1) + 1;
        }

        if (SINGLE_MEDIA_KINDS.includes(kind)) {
          replaced = await tx.mediaAsset.findMany({ where: { invitationId, kind } });
          if (replaced.length) {
            await tx.mediaAsset.deleteMany({ where: { id: { in: replaced.map((m) => m.id) } } });
          }
        }

        return tx.mediaAsset.create({
          data: {
            invitationId,
            kind,
            storageKey: prepared.storageKey,
            variants: prepared.variants ?? Prisma.DbNull,
            mimeType: prepared.mimeType,
            sizeBytes: prepared.sizeBytes,
            width: prepared.width,
            height: prepared.height,
            sortOrder,
          },
        });
      });
    } catch (err) {
      await this.storage.deleteMany(prepared.uploadedKeys);
      throw err;
    }

    await this.storage.deleteMany(replaced.flatMap((m) => this.keysOf(m)));
    return this.presenter.media(created);
  }

  async remove(invitationId: string, mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: mediaId, invitationId } });
    if (!asset) throw ApiError.notFound();
    await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
    await this.storage.deleteMany(this.keysOf(asset));
  }

  /** Galereya tartibi: ids ro'yxatidagi ketma-ketlik bo'yicha. */
  async reorder(invitationId: string, ids: string[]): Promise<MediaView[]> {
    const unique = [...new Set(ids)];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { invitationId, kind: 'GALLERY' },
      select: { id: true },
    });
    const owned = new Set(assets.map((a) => a.id));
    if (unique.length !== ids.length || unique.some((id) => !owned.has(id))) {
      throw ApiError.badRequest('VALIDATION_ERROR');
    }
    await this.prisma.$transaction(
      unique.map((id, index) =>
        this.prisma.mediaAsset.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    const updated = await this.prisma.mediaAsset.findMany({
      where: { invitationId, kind: 'GALLERY' },
      orderBy: { sortOrder: 'asc' },
    });
    return updated.map((m) => this.presenter.media(m));
  }

  private async prepare(
    invitationId: string,
    kind: MediaKind,
    file: Express.Multer.File,
  ): Promise<PreparedUpload> {
    const base = `invitations/${invitationId}/${kind.toLowerCase()}/${randomUUID()}`;

    if (kind === 'MUSIC') {
      if (file.size > MEDIA_LIMITS.audioMaxBytes) throw ApiError.badRequest('FILE_TOO_LARGE');
      const audio = detectAudio(file.buffer);
      if (!audio) throw ApiError.badRequest('UNSUPPORTED_FILE_TYPE');
      const key = `${base}.${audio.ext}`;
      await this.storage.put(key, file.buffer, audio.mime);
      return {
        storageKey: key,
        variants: null,
        mimeType: audio.mime,
        sizeBytes: file.size,
        width: null,
        height: null,
        uploadedKeys: [key],
      };
    }

    if (file.size > MEDIA_LIMITS.imageMaxBytes) throw ApiError.badRequest('FILE_TOO_LARGE');
    const processed =
      kind === 'OG_IMAGE'
        ? await this.images.og(file.buffer)
        : await this.images.responsive(file.buffer, kind === 'COVER');

    const variants: MediaVariantKeys = {};
    const uploadedKeys: string[] = [];
    try {
      await Promise.all(
        processed.files.map(async (f) => {
          const key = `${base}-${f.name}.${f.ext}`;
          await this.storage.put(key, f.buffer, f.mime);
          variants[f.name] = key;
          uploadedKeys.push(key);
        }),
      );
    } catch (err) {
      await this.storage.deleteMany(uploadedKeys);
      throw err;
    }

    const main = kind === 'OG_IMAGE' ? variants.og! : variants.lg!;
    const mainFile = processed.files.find((f) => f.name === (kind === 'OG_IMAGE' ? 'og' : 'lg'))!;
    return {
      storageKey: main,
      variants: kind === 'OG_IMAGE' ? null : variants,
      mimeType: mainFile.mime,
      sizeBytes: processed.files.reduce((sum, f) => sum + f.buffer.length, 0),
      width: processed.width,
      height: processed.height,
      uploadedKeys,
    };
  }

  private keysOf(asset: Pick<MediaAsset, 'storageKey' | 'variants'>): string[] {
    const variantKeys = Object.values((asset.variants ?? {}) as MediaVariantKeys);
    return [...new Set([asset.storageKey, ...variantKeys])];
  }
}
