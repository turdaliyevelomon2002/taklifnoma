import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramWebAppUser;
  /** t.me/<bot>/<ilova>?startapp=<slug> dagi parametr. */
  startParam: string | null;
  authDate: Date;
}

/**
 * Telegram Mini App initData'sini tekshiradi
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *   secret = HMAC_SHA256(key="WebAppData", bot_token)
 *   hash   = hex(HMAC_SHA256(key=secret, "k1=v1\nk2=v2..."))  (hash'dan boshqa maydonlar, alifbo tartibida)
 * Imzo bot tokeni bilan qo'yiladi, shuning uchun brauzer uni qalbakilashtira olmaydi.
 * maxAgeSec: eski initData'ni qayta ishlatishdan himoya (har ochilishda Telegram yangisini beradi).
 */
export function verifyInitData(
  raw: string,
  botToken: string,
  maxAgeSec = 24 * 3600,
  now = Date.now(),
): VerifiedInitData | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authSec = Number(params.get('auth_date'));
  if (!Number.isFinite(authSec) || authSec <= 0) return null;
  // Kelajakdagi sana (soat farqi) uchun 5 daqiqa bardosh.
  if (now / 1000 - authSec > maxAgeSec || authSec - now / 1000 > 300) return null;

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(params.get('user') ?? '') as TelegramWebAppUser;
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || typeof user.first_name !== 'string') return null;

  return { user, startParam: params.get('start_param'), authDate: new Date(authSec * 1000) };
}

/** Panel va xabarlarda ko'rsatiladigan ism: "Ism Familiya". */
export function telegramDisplayName(user: TelegramWebAppUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim().slice(0, 100);
}

/** Testlar va lokal sinov uchun: initData'ni bot tokeni bilan imzolash. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const checkString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
