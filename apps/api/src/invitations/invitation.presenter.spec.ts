import type { Invitation, MediaAsset } from '@prisma/client';
import { invitationConfigSchema } from '@taklifnoma/shared';
import type { AppConfig } from '../config/app-config.service';
import type { StorageService } from '../storage/storage.service';
import type { TelegramLinkService } from '../telegram/telegram-link.service';
import { InvitationPresenter } from './invitation.presenter';

const storage = { publicUrl: (k: string) => `https://cdn.test/${k}` } as StorageService;
const config = { get: () => 'https://toy.uz' } as unknown as AppConfig;
const telegram = { coupleLink: () => null } as unknown as TelegramLinkService;
const presenter = new InvitationPresenter(storage, config, telegram);

const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

function invitation(overrides: Partial<Invitation> = {}, media: MediaAsset[] = []) {
  const cfg = invitationConfigSchema.parse({
    version: 1,
    locales: ['uz', 'ru'],
    defaultLocale: 'ru',
    couple: { groom: { firstName: { uz: 'Ali' } }, bride: { firstName: { uz: 'Madina' } } },
    events: [
      {
        id: 'toy',
        title: { uz: "To'y" },
        startsAt: future,
        isPrimary: true,
        venue: { name: { uz: 'X' }, address: { uz: 'Y' }, location: { lat: 41, lng: 69 } },
      },
    ],
    rsvp: {},
  });
  return {
    id: 'inv-1',
    slug: 'ali-madina',
    templateKey: 'classic-gold',
    package: 'BASIC',
    status: 'ACTIVE',
    config: cfg,
    featureOverrides: null,
    media,
    ...overrides,
  } as unknown as Invitation & { media: MediaAsset[] };
}

function asset(kind: MediaAsset['kind'], sortOrder = 0, variants: object | null = null): MediaAsset {
  return {
    id: `${kind}-${sortOrder}`,
    invitationId: 'inv-1',
    kind,
    storageKey: `${kind}-${sortOrder}.webp`,
    variants,
    mimeType: 'image/webp',
    sizeBytes: 1,
    width: 100,
    height: 100,
    sortOrder,
    createdAt: new Date(),
  } as MediaAsset;
}

describe('InvitationPresenter.publicView', () => {
  it('BASIC paketda musiqa, galereya va rus tili berilmaydi', () => {
    const view = presenter.publicView(
      invitation({}, [asset('MUSIC'), asset('GALLERY', 0), asset('GALLERY', 1)]),
    );
    expect(view.media.music).toBeUndefined();
    expect(view.media.gallery).toHaveLength(0);
    expect(view.config.locales).toEqual(['uz']);
    expect(view.config.defaultLocale).toBe('uz');
  });

  it('galereyani paket limiti bilan kesadi va tartib bo\'yicha qaytaradi', () => {
    const gallery = Array.from({ length: 15 }, (_, i) => asset('GALLERY', 14 - i));
    const view = presenter.publicView(invitation({ package: 'STANDARD' }, gallery));
    expect(view.media.gallery).toHaveLength(12);
    expect(view.media.gallery[0]!.sortOrder).toBe(0);
  });

  it('OG rasm yo\'q bo\'lsa cover\'dan yasalgan og variantini oladi', () => {
    const cover = asset('COVER', 0, { lg: 'c-lg.webp', og: 'c-og.jpg' });
    const view = presenter.publicView(invitation({}, [cover]));
    expect(view.seo.ogImageUrl).toBe('https://cdn.test/c-og.jpg');
    expect(view.seo.canonicalUrl).toBe('https://toy.uz/ali-madina');
  });

  it('qoralama holatida RSVP yopiq', () => {
    expect(presenter.publicView(invitation()).rsvpOpen).toBe(true);
    expect(presenter.publicView(invitation({ status: 'DRAFT' })).rsvpOpen).toBe(false);
  });
});
