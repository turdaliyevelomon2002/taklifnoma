import type { WishStatus } from '@prisma/client';
import type { Locale } from '@taklifnoma/shared';
import { t } from '../i18n/translator';
import type { TgInlineButton } from './telegram-api.service';

/**
 * Tilak tugmalari callback_data formati (64 baytgacha):
 *   w:a:<wishId>  tasdiqlash (devorga chiqarish)
 *   w:h:<wishId>  yashirish
 *   w:n           holat yorlig'i (hech narsa qilmaydi)
 */
export const WISH_CALLBACK_RE = /^w:(a|h|n)(?::([0-9a-f-]{36}))?$/;

/**
 * Tilak holatiga qarab tugmalar:
 *   PENDING  -> [Ko'rsatish] [Yashirish]
 *   APPROVED -> "Devorda ko'rinmoqda" yorlig'i + [Yashirish]  (fikr o'zgarsa qaytarish mumkin)
 *   HIDDEN   -> "Yashirilgan" yorlig'i + [Ko'rsatish]
 * panel: juftlik uchun "Mehmonlar ro'yxati" havolasi (https bo'lmasa Telegram API qatlami olib tashlaydi).
 */
export function wishKeyboard(
  locale: Locale,
  wishId: string,
  status: WishStatus,
  panel?: { text: string; url: string },
): TgInlineButton[][] {
  const approve = { text: t(locale, 'telegram.wish.approve'), callback_data: `w:a:${wishId}` };
  const hide = { text: t(locale, 'telegram.wish.hide'), callback_data: `w:h:${wishId}` };
  const rows: TgInlineButton[][] =
    status === 'PENDING'
      ? [[approve, hide]]
      : status === 'APPROVED'
        ? [[{ text: t(locale, 'telegram.wish.isApproved'), callback_data: 'w:n' }], [hide]]
        : [[{ text: t(locale, 'telegram.wish.isHidden'), callback_data: 'w:n' }], [approve]];
  if (panel) rows.push([panel]);
  return rows;
}
