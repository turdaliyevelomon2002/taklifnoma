import { formatUzPhone, type Locale, type RsvpStats } from '@taklifnoma/shared';
import { escapeHtml, t } from '../i18n/translator';

export interface RsvpMessageInput {
  locale: Locale;
  isUpdate: boolean;
  /** "Ali & Madina" */
  coupleNames: string;
  /** Owner uchun: qaysi taklifnoma ekanini ko'rsatish. */
  slug?: string;
  guest: {
    name: string;
    phone: string | null;
    attending: boolean;
    guestCount: number;
    wish: string | null;
  };
  stats: RsvpStats;
}

const WISH_MAX_IN_MESSAGE = 600;

/** Telegram HTML xabari. Mehmon kiritgan barcha matnlar escape qilinadi. */
export function buildRsvpMessage(input: RsvpMessageInput): string {
  const { locale: l, guest } = input;
  const title = t(l, input.isUpdate ? 'telegram.rsvp.titleUpdated' : 'telegram.rsvp.titleNew');
  const header = input.slug
    ? `<b>${title}</b> · ${escapeHtml(input.coupleNames)} <code>/${escapeHtml(input.slug)}</code>`
    : `<b>${title}</b> · ${escapeHtml(input.coupleNames)}`;

  const lines = [header, '', `👤 <b>${escapeHtml(guest.name)}</b>`];
  if (guest.phone) lines.push(`📞 ${escapeHtml(formatUzPhone(guest.phone))}`);
  lines.push(
    guest.attending
      ? t(l, 'telegram.rsvp.attending', { count: guest.guestCount })
      : t(l, 'telegram.rsvp.notAttending'),
  );
  if (guest.wish) {
    const wish =
      guest.wish.length > WISH_MAX_IN_MESSAGE ? `${guest.wish.slice(0, WISH_MAX_IN_MESSAGE)}…` : guest.wish;
    lines.push(t(l, 'telegram.rsvp.wish', { wish: `<i>${escapeHtml(wish)}</i>` }));
  }
  lines.push(
    '',
    t(l, 'telegram.rsvp.summary', {
      guests: input.stats.attendingGuests,
      replies: input.stats.replies,
    }),
  );
  return lines.join('\n');
}
