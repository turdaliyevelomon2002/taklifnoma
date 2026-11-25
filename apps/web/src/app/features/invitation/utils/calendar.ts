import type { EventItem } from '@taklifnoma/shared';

/** 2027-06-14T18:00:00+05:00 -> 20270614T130000Z (Google Calendar UTC formati). */
function gcalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * "Kalendarga qo'shish": Google Calendar'ning tayyor shabloni (API kalit kerak emas).
 * Telefonda Google Calendar ilovasi yoki brauzer ochiladi.
 */
export function googleCalendarUrl(event: EventItem, title: string, venue: string, address: string): string {
  const start = Date.parse(event.startsAt);
  const end = event.endsAt ? event.endsAt : new Date(start + 3 * 3600_000).toISOString();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${gcalDate(event.startsAt)}/${gcalDate(end)}`,
    location: [venue, address].filter(Boolean).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
