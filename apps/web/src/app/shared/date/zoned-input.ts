import { zonedParts } from './datetime';

/**
 * <input type="datetime-local"> qiymatlari ("2027-06-14T18:00") taklifnoma vaqt mintaqasida
 * talqin qilinadi, brauzernikida emas: owner Moskvada bo'lsa ham Toshkent vaqtini kiritadi.
 */

const pad = (n: number | string) => String(n).padStart(2, '0');

/** ISO -> "YYYY-MM-DDTHH:mm" (tz bo'yicha). */
export function isoToZonedInput(iso: string | undefined | null, timeZone: string): string {
  if (!iso) return '';
  const p = zonedParts(iso, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${p.hour}:${p.minute}`;
}

/** Berilgan lahzada tz'ning UTC'dan farqi (ms). */
function offsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(new Date(utcMs).toISOString(), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, Number(p.hour), Number(p.minute)) - Math.floor(utcMs / 60_000) * 60_000;
}

/** "YYYY-MM-DDTHH:mm" (tz bo'yicha) -> ISO (UTC). Noto'g'ri qiymat bo'lsa null. */
export function zonedInputToIso(value: string | undefined | null, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Ikki marta: yozgi vaqtga o'tish chegarasida ham to'g'ri natija beradi.
  let result = asUtc - offsetMs(asUtc, timeZone);
  result = asUtc - offsetMs(result, timeZone);
  return new Date(result).toISOString();
}
