import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const noTrailingSlash = (v: string) => v.replace(/\/+$/, '');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  PUBLIC_WEB_URL: z.string().url().transform(noTrailingSlash),
  CORS_ORIGINS: csv,
  COOKIE_SECURE: bool.optional(),

  DATABASE_URL: z.string().url(),

  OWNER_JWT_SECRET: z.string().min(32),
  COUPLE_JWT_SECRET: z.string().min(32),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool.default(true),
  S3_PUBLIC_URL: z.string().url().transform(noTrailingSlash),

  /** RSVP forma tokenlarini imzolash va IP xeshlash uchun. */
  RSVP_SECRET: z.string().min(32),

  /** BotFather bergan token. Bo'lmasa Telegram o'chiq. */
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]{30,}$/).optional(),
  /** Bot API manzili: o'zingiz host qilgan Bot API server yoki testlar uchun. */
  TELEGRAM_API_URL: z.string().url().default('https://api.telegram.org').transform(noTrailingSlash),
  /** polling: lokal dev; webhook: production; off: o'chiq. */
  TELEGRAM_MODE: z.enum(['off', 'polling', 'webhook']).optional(),
  /**
   * Polling rejimida bot'da webhook (masalan, production) o'rnatilgan bo'lsa, uni o'chirib botni olish.
   * false (default): webhook'ga tegilmaydi, lokal faqat xabar yuboradi (bitta botni prod bilan bo'lishganda).
   */
  TELEGRAM_POLLING_TAKEOVER: bool.default(false),
  /** Webhook rejimida: https://domen.uz/api/telegram/webhook */
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  /** Telegram har so'rovda X-Telegram-Bot-Api-Secret-Token sarlavhasida yuboradi. */
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/).optional(),
  /**
   * BotFather /newapp bilan yaratilgan Mini App'ning qisqa nomi (t.me/<bot>/<NOM>).
   * Mini App URL'i: https://domen.uz/tg. Berilmasa "faqat Telegram orqali" rejimi ishlamaydi.
   */
  TELEGRAM_MINIAPP_NAME: z.string().regex(/^[A-Za-z0-9_]{3,30}$/).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** @nestjs/config uchun validate funksiyasi: xato bo'lsa ilova umuman ishga tushmaydi. */
export function validateEnv(raw: Record<string, unknown>): Env {
  // .env dagi "KEY=" (bo'sh qiymat) "berilmagan" deb hisoblanadi.
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => !(typeof v === 'string' && v.trim() === '')),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment o'zgaruvchilari noto'g'ri:\n${details}`);
  }
  const env = result.data;
  if (env.COOKIE_SECURE === undefined) env.COOKIE_SECURE = env.NODE_ENV === 'production';
  env.TELEGRAM_MODE ??= env.TELEGRAM_BOT_TOKEN
    ? env.NODE_ENV === 'production'
      ? 'webhook'
      : 'polling'
    : 'off';
  if (env.TELEGRAM_MODE !== 'off' && !env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_MODE yoqilgan, lekin TELEGRAM_BOT_TOKEN berilmagan');
  }
  if (env.TELEGRAM_MODE === 'webhook' && (!env.TELEGRAM_WEBHOOK_URL || !env.TELEGRAM_WEBHOOK_SECRET)) {
    throw new Error('Webhook rejimi uchun TELEGRAM_WEBHOOK_URL va TELEGRAM_WEBHOOK_SECRET kerak');
  }
  if (env.NODE_ENV === 'production' && env.OWNER_JWT_SECRET.startsWith('change-me')) {
    throw new Error("Production'da OWNER_JWT_SECRET o'zgartirilishi shart");
  }
  return env;
}
