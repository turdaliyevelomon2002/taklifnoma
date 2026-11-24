import { buildRsvpMessage } from './rsvp-message';

const base = {
  locale: 'uz' as const,
  isUpdate: false,
  coupleNames: 'Ali & Madina',
  guest: { name: 'Aziz', phone: '+998901234567', attending: true, guestCount: 3, wish: null },
  stats: { replies: 18, attendingReplies: 15, attendingGuests: 45, notAttendingReplies: 3 },
};

describe('buildRsvpMessage', () => {
  it("o'zbekcha yangi javob xabari", () => {
    const msg = buildRsvpMessage(base);
    expect(msg).toContain('Yangi javob');
    expect(msg).toContain('<b>Aziz</b>');
    expect(msg).toContain('+998 90 123 45 67');
    expect(msg).toContain('Keladi · 3 kishi');
    expect(msg).toContain('Jami: 45 kishi keladi (18 ta javob)');
  });

  it('ruscha yangilangan javob, kelmaydigan mehmon', () => {
    const msg = buildRsvpMessage({
      ...base,
      locale: 'ru',
      isUpdate: true,
      guest: { ...base.guest, attending: false, guestCount: 0 },
    });
    expect(msg).toContain('Ответ изменён');
    expect(msg).toContain('Не сможет прийти');
  });

  it('mehmon matnidagi HTML escape qilinadi (Telegram HTML injection yo\'q)', () => {
    const msg = buildRsvpMessage({
      ...base,
      guest: { ...base.guest, name: '<a href="x">Hack</a>', wish: 'Baxt <b>&</b> omad' },
    });
    expect(msg).toContain('&lt;a href="x"&gt;Hack&lt;/a&gt;');
    expect(msg).toContain('Baxt &lt;b&gt;&amp;&lt;/b&gt; omad');
    expect(msg).not.toContain('<a href');
  });

  it('owner xabarida slug ko\'rsatiladi', () => {
    expect(buildRsvpMessage({ ...base, slug: 'ali-madina' })).toContain('<code>/ali-madina</code>');
  });
});
