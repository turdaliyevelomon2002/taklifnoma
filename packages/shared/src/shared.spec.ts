import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  invitationConfigSchema,
  normalizeUzPhone,
  resolveFeatures,
  slugSchema,
  suggestSlug,
  type InvitationConfigInput,
} from './index';

const validConfig = (): InvitationConfigInput => ({
  version: 1,
  locales: ['uz', 'ru'],
  defaultLocale: 'uz',
  couple: {
    groom: { firstName: { uz: 'Ali' } },
    bride: { firstName: { uz: 'Madina', ru: 'Мадина' } },
  },
  events: [
    {
      id: 'toy',
      title: { uz: "To'y" },
      startsAt: '2026-06-14T18:00:00+05:00',
      isPrimary: true,
      venue: {
        name: { uz: 'Oqsaroy' },
        address: { uz: 'Toshkent, Yunusobod' },
        location: { lat: 41.36, lng: 69.28 },
      },
    },
  ],
  rsvp: {},
});

describe('normalizeUzPhone', () => {
  it('turli formatlarni +998 ga keltiradi', () => {
    assert.equal(normalizeUzPhone('90 123 45 67'), '+998901234567');
    assert.equal(normalizeUzPhone('+998 (90) 123-45-67'), '+998901234567');
    assert.equal(normalizeUzPhone('998901234567'), '+998901234567');
  });
  it("noto'g'ri raqamni rad etadi", () => {
    assert.equal(normalizeUzPhone('12345'), null);
    assert.equal(normalizeUzPhone('+7 901 234 56 78'), null);
    assert.equal(normalizeUzPhone('012345678'), null);
  });
});

describe('slug', () => {
  it("band qilingan va noto'g'ri slug'larni rad etadi", () => {
    assert.equal(slugSchema.safeParse('panel').success, false);
    assert.equal(slugSchema.safeParse('ali--madina').success, false);
    assert.equal(slugSchema.safeParse('ab').success, false);
    assert.equal(slugSchema.safeParse('Ali-Madina').data, 'ali-madina');
  });
  it('ismlardan slug taklif qiladi', () => {
    assert.equal(suggestSlug('Ali', 'Madina'), 'ali-madina');
    assert.equal(suggestSlug("G'ayrat", "O'g'iloy"), 'gayrat-ogiloy');
    assert.equal(suggestSlug('Шахзод', 'Юлдуз'), 'shaxzod-yulduz');
  });
});

describe('invitationConfigSchema', () => {
  it("to'g'ri config'ni qabul qiladi va default qiymatlarni qo'yadi", () => {
    const result = invitationConfigSchema.parse(validConfig());
    assert.equal(result.timezone, 'Asia/Tashkent');
    assert.equal(result.rsvp.maxGuestsPerReply, 5);
    assert.equal(result.couple.order, 'groom-first');
    assert.equal(result.couple.groom.firstName.ru, undefined);
  });
  it('asosiy tadbir aniq bitta bo\'lishini talab qiladi', () => {
    const cfg = validConfig();
    cfg.events.push({ ...cfg.events[0]!, id: 'nikoh' });
    const result = invitationConfigSchema.safeParse(cfg);
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((i) => i.message === 'exactly_one_primary_event'));
  });
  it('defaultLocale yoqilgan tillar ichida bo\'lishi kerak', () => {
    const cfg = { ...validConfig(), locales: ['uz' as const], defaultLocale: 'ru' as const };
    assert.equal(invitationConfigSchema.safeParse(cfg).success, false);
  });
});

describe('resolveFeatures', () => {
  it('paket qiymatlari ustiga override qo\'llaydi', () => {
    const f = resolveFeatures('BASIC', { music: true });
    assert.equal(f.music, true);
    assert.equal(f.gallery, false);
  });
  it('gallery o\'chiq bo\'lsa limit 0 bo\'ladi', () => {
    const f = resolveFeatures('PREMIUM', { gallery: false });
    assert.equal(f.galleryLimit, 0);
  });
});
