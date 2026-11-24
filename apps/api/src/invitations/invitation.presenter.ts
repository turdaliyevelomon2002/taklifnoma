import { Injectable } from '@nestjs/common';
import type { Invitation, MediaAsset } from '@prisma/client';
import {
  getPrimaryEvent,
  resolveFeatures,
  type FeatureFlags,
  type FeatureOverrides,
  type ImageVariant,
  type InvitationConfig,
  type InvitationDetail,
  type InvitationListItem,
  type MediaView,
  type PublicInvitation,
  type RsvpStats,
  type TemplateKey,
} from '@taklifnoma/shared';
import { iso, isoOrNull } from '../common/iso';
import { coupleNames } from '../common/localize';
import { AppConfig } from '../config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';

export type MediaVariantKeys = Partial<Record<ImageVariant | 'og', string>>;

/** DB modellarini API javoblariga aylantiradi. Maxfiy maydonlar (xeshlar) hech qachon chiqmaydi. */
@Injectable()
export class InvitationPresenter {
  constructor(
    private readonly storage: StorageService,
    private readonly config: AppConfig,
    private readonly telegram: TelegramLinkService,
  ) {}

  features(inv: Pick<Invitation, 'package' | 'featureOverrides'>): FeatureFlags {
    return resolveFeatures(inv.package, inv.featureOverrides as FeatureOverrides | null);
  }

  publicUrl(slug: string): string {
    return `${this.config.get('PUBLIC_WEB_URL')}/${slug}`;
  }

  media(asset: MediaAsset): MediaView {
    const keys = (asset.variants ?? {}) as MediaVariantKeys;
    const variants: MediaView['variants'] = {};
    for (const name of ['sm', 'md', 'lg'] as const) {
      if (keys[name]) variants[name] = this.storage.publicUrl(keys[name]);
    }
    return {
      id: asset.id,
      kind: asset.kind,
      url: this.storage.publicUrl(asset.storageKey),
      mimeType: asset.mimeType,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      variants: Object.keys(variants).length ? variants : undefined,
      ogUrl: keys.og ? this.storage.publicUrl(keys.og) : undefined,
      sortOrder: asset.sortOrder,
    };
  }

  listItem(inv: Invitation, stats: RsvpStats): InvitationListItem {
    return {
      id: inv.id,
      slug: inv.slug,
      templateKey: inv.templateKey as TemplateKey,
      package: inv.package,
      status: inv.status,
      coupleNames: coupleNames(inv.config as InvitationConfig, 'uz'),
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      eventDate: iso(inv.eventDate),
      price: inv.price,
      paidAt: isoOrNull(inv.paidAt),
      createdAt: iso(inv.createdAt),
      stats,
    };
  }

  detail(inv: Invitation & { media: MediaAsset[] }, stats: RsvpStats): InvitationDetail {
    return {
      ...this.listItem(inv, stats),
      config: inv.config as InvitationConfig,
      featureOverrides: (inv.featureOverrides as FeatureOverrides | null) ?? null,
      features: this.features(inv),
      notes: inv.notes,
      publishedAt: isoOrNull(inv.publishedAt),
      expiresAt: isoOrNull(inv.expiresAt),
      updatedAt: iso(inv.updatedAt),
      coupleTelegramLinked: !!inv.coupleChatId,
      telegramLinkUrl: this.telegram.coupleLink(inv.telegramLinkCode),
      pinEnabled: !!inv.adminPinHash,
      media: this.sortMedia(inv.media).map((m) => this.media(m)),
      publicUrl: this.publicUrl(inv.slug),
    };
  }

  /** Mehmon sahifasi uchun: paket funksiyalari shu yerda qo'llanadi. */
  publicView(inv: Invitation & { media: MediaAsset[] }, now = new Date()): PublicInvitation {
    const features = this.features(inv);
    const stored = inv.config as InvitationConfig;
    const config: InvitationConfig = features.multiLanguage
      ? stored
      : { ...stored, locales: ['uz'], defaultLocale: 'uz' };

    const media = this.sortMedia(inv.media);
    const cover = media.find((m) => m.kind === 'COVER');
    const music = features.music ? media.find((m) => m.kind === 'MUSIC') : undefined;
    const ogAsset = media.find((m) => m.kind === 'OG_IMAGE');
    const gallery = features.gallery
      ? media.filter((m) => m.kind === 'GALLERY').slice(0, features.galleryLimit)
      : [];

    const coverView = cover ? this.media(cover) : undefined;
    const ogImageUrl = ogAsset ? this.media(ogAsset).url : coverView?.ogUrl;

    const rsvpOpen = this.isRsvpOpen(inv, now);

    return {
      slug: inv.slug,
      templateKey: inv.templateKey as TemplateKey,
      config,
      features,
      media: {
        cover: coverView,
        gallery: gallery.map((m) => this.media(m)),
        music: music ? this.media(music) : undefined,
      },
      seo: { ogImageUrl, canonicalUrl: this.publicUrl(inv.slug) },
      rsvpOpen,
    };
  }

  /** RSVP qabul qilinadimi: ACTIVE, paketda yoqilgan, deadline va asosiy tadbir o'tmagan. */
  isRsvpOpen(inv: Pick<Invitation, 'status' | 'package' | 'featureOverrides' | 'config'>, now = new Date()): boolean {
    const config = inv.config as InvitationConfig;
    const deadline = config.rsvp.deadline ? new Date(config.rsvp.deadline) : null;
    const primaryStart = new Date(getPrimaryEvent(config).startsAt);
    return (
      inv.status === 'ACTIVE' &&
      this.features(inv).rsvp &&
      (!deadline || deadline > now) &&
      primaryStart > now
    );
  }

  private sortMedia(media: MediaAsset[]): MediaAsset[] {
    return [...media].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}
