import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { AppConfig } from '../config/app-config.service';
import type { TgUpdate } from './telegram-api.service';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
@SkipThrottle()
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly bot: TelegramBotService,
    private readonly config: AppConfig,
  ) {}

  /** Telegram so'rovlari X-Telegram-Bot-Api-Secret-Token sarlavhasi bilan tekshiriladi. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TgUpdate,
  ): Promise<void> {
    const expected = this.config.get('TELEGRAM_WEBHOOK_SECRET');
    if (this.config.get('TELEGRAM_MODE') !== 'webhook' || !expected || !safeEqual(secret ?? '', expected)) {
      throw ApiError.notFound();
    }
    // Xato bo'lsa ham 200 qaytadi: aks holda Telegram shu update'ni qayta-qayta yuboradi.
    await this.bot.handleUpdate(update).catch((err) =>
      this.logger.error(`Webhook update xatosi: ${String(err)}`),
    );
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
