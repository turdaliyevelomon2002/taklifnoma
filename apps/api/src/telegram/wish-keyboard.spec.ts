import { buildRsvpMessage } from './rsvp-message';
import { WISH_CALLBACK_RE, wishKeyboard } from './wish-keyboard';

const ID = '3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const callbacks = (rows: ReturnType<typeof wishKeyboard>) =>
  rows.flat().map((b) => ('callback_data' in b ? b.callback_data : `url:${b.url}`));

describe('wishKeyboard', () => {
  it('PENDING: tasdiqlash va yashirish', () => {
    expect(callbacks(wishKeyboard('uz', ID, 'PENDING'))).toEqual([`w:a:${ID}`, `w:h:${ID}`]);
  });

  it('APPROVED: holat yorlig\'i + yashirish', () => {
    expect(callbacks(wishKeyboard('uz', ID, 'APPROVED'))).toEqual(['w:n', `w:h:${ID}`]);
  });

  it('HIDDEN: holat yorlig\'i + ko\'rsatish, panel havolasi oxirida', () => {
    const rows = wishKeyboard('ru', ID, 'HIDDEN', { text: 'Panel', url: 'https://domen.uz/x/admin' });
    expect(callbacks(rows)).toEqual(['w:n', `w:a:${ID}`, 'url:https://domen.uz/x/admin']);
  });

  it('callback_data 64 baytdan oshmaydi va regex bilan o\'qiladi', () => {
    for (const data of callbacks(wishKeyboard('uz', ID, 'PENDING'))) {
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(WISH_CALLBACK_RE.exec(data)?.[2]).toBe(ID);
    }
    expect(WISH_CALLBACK_RE.test('w:a:not-a-uuid; DROP')).toBe(false);
  });
});

describe('buildRsvpMessage: tilak holati', () => {
  const base = {
    locale: 'uz' as const,
    isUpdate: false,
    coupleNames: 'Ali & Madina',
    guest: { name: 'Jasur', phone: null, attending: true, guestCount: 2, wish: 'Baxtli bo\'linglar' },
    stats: { replies: 1, attendingReplies: 1, attendingGuests: 2, notAttendingReplies: 0, pendingWishes: 1 },
  };

  it('PENDING va shubhali tilak uchun ogohlantirishlar', () => {
    const msg = buildRsvpMessage({ ...base, guest: { ...base.guest, wishStatus: 'PENDING', wishFlagged: true } });
    expect(msg).toContain('⏳');
    expect(msg).toContain('⚠️');
  });

  it('Telegram username ko\'rsatiladi', () => {
    const msg = buildRsvpMessage({ ...base, guest: { ...base.guest, telegramUsername: 'jasur_k' } });
    expect(msg).toContain('@jasur_k');
  });

  it('tasdiqlangan tilakda ogohlantirish yo\'q', () => {
    const msg = buildRsvpMessage({ ...base, guest: { ...base.guest, wishStatus: 'APPROVED' } });
    expect(msg).not.toContain('⏳');
    expect(msg).not.toContain('⚠️');
  });
});
