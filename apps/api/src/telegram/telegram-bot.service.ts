import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { InvitationConfig } from '@taklifnoma/shared';
import { AppConfig } from '../config/app-config.service';
import { coupleNames } from '../common/localize';
import { escapeHtml, t } from '../i18n/translator';
import { PrismaService } from '../prisma/prisma.service';
import type { Locale } from '@taklifnoma/shared';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { TelegramApi, TelegramApiError, type TgCallbackQuery, type TgMessage, type TgUpdate } from './telegram-api.service';
import { WISH_CALLBACK_RE, wishKeyboard } from './wish-keyboard';
import { START_PREFIX } from './telegram-link.service';

const START_RE = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?\s*$/;
const STOP_RE = /^\/stop(?:@\w+)?\s*$/;

/**
 * Bot komandalari:
 *   /start c_<kod>  juftlik chatini taklifnomaga ulaydi
 *   /start o_<kod>  owner chatini ulaydi
 *   /stop           shu chatga ulangan bildirishnomalarni o'chiradi
 *   tugmalar        tilakni tasdiqlash / yashirish (callback_query, w:a:<id> / w:h:<id>)
 *
 * Yangilanishlar dev'da long polling, production'da webhook orqali keladi.
 */
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBotService.name);
  private polling = false;
  private readonly abort = new AbortController();

  constructor(
    private readonly api: TelegramApi,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly presenter: InvitationPresenter,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.api.enabled) return;
    const mode = this.config.get('TELEGRAM_MODE');
    try {
      if (mode === 'webhook') {
        await this.api.call('setWebhook', {
          url: this.config.get('TELEGRAM_WEBHOOK_URL'),
          secret_token: this.config.get('TELEGRAM_WEBHOOK_SECRET'),
          allowed_updates: ['message', 'callback_query'],
        });
        this.logger.log('Telegram webhook o\'rnatildi');
      } else if (mode === 'polling') {
        // Webhook o'rnatilgan bo'lsa getUpdates ishlamaydi. Bot production bilan bo'lishilgan bo'lsa,
        // uning webhook'ini jimgina o'chirib qo'ymaymiz: faqat ruxsat berilganda (TAKEOVER) olamiz.
        const info = await this.api.call<{ url?: string }>('getWebhookInfo');
        if (info.url && !this.config.get('TELEGRAM_POLLING_TAKEOVER')) {
          this.logger.warn(
            `Bot'da webhook o'rnatilgan (${new URL(info.url).host}): polling boshlanmadi, faqat xabar yuboriladi. ` +
              `Botni lokalga olish uchun TELEGRAM_POLLING_TAKEOVER=true (production keyingi ishga tushishida qaytarib oladi).`,
          );
          return;
        }
        await this.api.call('deleteWebhook', { drop_pending_updates: false });
        this.polling = true;
        void this.pollLoop();
        this.logger.log('Telegram long polling boshlandi');
      }
    } catch (err) {
      this.logger.error(`Telegram'ni ishga tushirib bo'lmadi: ${String(err)}`);
    }
  }

  onApplicationShutdown(): void {
    this.polling = false;
    this.abort.abort();
  }

  async handleUpdate(update: TgUpdate): Promise<void> {
    if (update.callback_query) return this.onCallback(update.callback_query);
    const message = update.message;
    if (!message?.text) return;
    const text = message.text.trim();

    const start = START_RE.exec(text);
    if (start) return this.onStart(message, start[1]);
    if (STOP_RE.test(text)) return this.onStop(message);
  }

  private async onStart(message: TgMessage, payload?: string): Promise<void> {
    const chatId = message.chat.id;
    if (!payload) {
      await this.api.reply(chatId, `${t('uz', 'telegram.start.help')}\n\n${t('ru', 'telegram.start.help')}`);
      return;
    }

    if (payload.startsWith(START_PREFIX.couple)) {
      const code = payload.slice(START_PREFIX.couple.length);
      const inv = await this.prisma.invitation.findUnique({
        where: { telegramLinkCode: code },
        select: { id: true, config: true },
      });
      if (inv) {
        await this.prisma.invitation.update({
          where: { id: inv.id },
          data: { coupleChatId: String(chatId) },
        });
        const config = inv.config as InvitationConfig;
        const locale = config.defaultLocale;
        await this.api.reply(
          chatId,
          t(locale, 'telegram.start.coupleLinked', { names: escapeHtml(coupleNames(config, locale)) }),
        );
        this.logger.log(`Juftlik chati ulandi: invitation ${inv.id}`);
        return;
      }
    }

    if (payload.startsWith(START_PREFIX.owner)) {
      const code = payload.slice(START_PREFIX.owner.length);
      const owner = await this.prisma.owner.findUnique({ where: { telegramLinkCode: code } });
      if (owner) {
        await this.prisma.owner.update({
          where: { id: owner.id },
          data: { telegramChatId: String(chatId) },
        });
        await this.api.reply(chatId, t('uz', 'telegram.start.ownerLinked'));
        this.logger.log(`Owner chati ulandi: ${owner.id}`);
        return;
      }
    }

    await this.api.reply(
      chatId,
      `${t('uz', 'telegram.start.invalidCode')}\n\n${t('ru', 'telegram.start.invalidCode')}`,
    );
  }

  /**
   * Tilak tugmalari. Faqat shu taklifnoma juftligining chati yoki owner chati bosishi mumkin:
   * xabar boshqa joyga forward qilinsa ham begona odam tilakni o'zgartira olmaydi.
   */
  private async onCallback(q: TgCallbackQuery): Promise<void> {
    const match = WISH_CALLBACK_RE.exec(q.data ?? '');
    const chat = q.message?.chat.id;
    if (!match || match[1] === 'n' || !match[2] || chat === undefined) {
      await this.api.answerCallback(q.id);
      return;
    }
    const [, action, wishId] = match;
    const chatId = String(chat);

    const wish = await this.prisma.wish.findUnique({
      where: { id: wishId },
      select: { id: true, invitation: { select: { slug: true, config: true, coupleChatId: true } } },
    });
    if (!wish) {
      await this.api.answerCallback(q.id, t('uz', 'telegram.wish.notFound'));
      return;
    }

    const isCouple = wish.invitation.coupleChatId === chatId;
    const isOwner = !isCouple && (await this.prisma.owner.count({ where: { telegramChatId: chatId } })) > 0;
    const config = wish.invitation.config as InvitationConfig;
    const locale: Locale = isCouple ? config.defaultLocale : 'uz';
    if (!isCouple && !isOwner) {
      await this.api.answerCallback(q.id, t(locale, 'telegram.wish.forbidden'));
      return;
    }

    const status = action === 'a' ? ('APPROVED' as const) : ('HIDDEN' as const);
    await this.prisma.wish.update({ where: { id: wish.id }, data: { status } });
    await this.api.answerCallback(
      q.id,
      t(locale, status === 'APPROVED' ? 'telegram.wish.approvedToast' : 'telegram.wish.hiddenToast'),
    );
    const panel = isCouple
      ? { text: t(locale, 'telegram.rsvp.openPanel'), url: `${this.presenter.publicUrl(wish.invitation.slug)}/admin` }
      : undefined;
    if (q.message) await this.api.editKeyboard(chat, q.message.message_id, wishKeyboard(locale, wish.id, status, panel));
    this.logger.log(`Tilak ${wish.id}: ${status} (${isCouple ? 'juftlik' : 'owner'}, Telegram)`);
  }

  private async onStop(message: TgMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const [invitations, owners] = await this.prisma.$transaction([
      this.prisma.invitation.updateMany({ where: { coupleChatId: chatId }, data: { coupleChatId: null } }),
      this.prisma.owner.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } }),
    ]);
    const key = invitations.count + owners.count > 0 ? 'telegram.stop.done' : 'telegram.stop.nothing';
    await this.api.reply(message.chat.id, `${t('uz', key)}\n\n${t('ru', key)}`);
  }

  private async pollLoop(): Promise<void> {
    let offset = 0;
    while (this.polling) {
      try {
        const updates = await this.api.call<TgUpdate[]>(
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] },
          35_000,
          this.abort.signal,
        );
        for (const update of updates) {
          offset = update.update_id + 1;
          await this.handleUpdate(update).catch((err) =>
            this.logger.error(`Update ${update.update_id} xatosi: ${String(err)}`),
          );
        }
      } catch (err) {
        if (!this.polling) return;
        // 409: boshqa joyda (production) webhook qayta o'rnatildi. Talashmaymiz, polling'ni to'xtatamiz.
        if (err instanceof TelegramApiError && err.errorCode === 409) {
          this.polling = false;
          this.logger.warn("Bot'ni webhook (production) qaytarib oldi: polling to'xtatildi, faqat xabar yuboriladi.");
          return;
        }
        this.logger.warn(`getUpdates xatosi, 5 soniyadan keyin qayta: ${String(err)}`);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }
}
