import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';

export class TelegramApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly description: string,
    readonly retryAfterSec?: number,
  ) {
    super(`Telegram API ${errorCode}: ${description}`);
  }

  /** Qayta urinish foyda bermaydi: bot bloklangan, chat topilmadi va h.k. */
  get isPermanent(): boolean {
    return this.errorCode === 403 || (this.errorCode === 400 && /chat not found/i.test(this.description));
  }
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

export interface TgUser {
  id: number;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface SendMessageOptions {
  /** Xabar ostidagi tugma (faqat https havolalar; Telegram localhost'ni qabul qilmaydi). */
  button?: { text: string; url: string };
}

/**
 * Telegram Bot API'ning yupqa klienti (tashqi kutubxonasiz).
 * Token URL ichida bo'lgani uchun so'rov URL'lari hech qachon log qilinmaydi.
 */
@Injectable()
export class TelegramApi {
  private readonly logger = new Logger(TelegramApi.name);
  private readonly baseUrl: string | null;

  constructor(config: AppConfig) {
    const token = config.get('TELEGRAM_BOT_TOKEN');
    this.baseUrl =
      token && config.get('TELEGRAM_MODE') !== 'off'
        ? `${config.get('TELEGRAM_API_URL')}/bot${token}`
        : null;
  }

  get enabled(): boolean {
    return this.baseUrl !== null;
  }

  async call<T>(method: string, payload: object = {}, timeoutMs = 15_000, signal?: AbortSignal): Promise<T> {
    if (!this.baseUrl) throw new Error('Telegram is disabled');
    const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.any(signals),
    });
    const body = (await res.json()) as TelegramResponse<T>;
    if (!body.ok) {
      throw new TelegramApiError(
        body.error_code ?? res.status,
        body.description ?? 'unknown error',
        body.parameters?.retry_after,
      );
    }
    return body.result as T;
  }

  sendMessage(chatId: string | number, html: string, options: SendMessageOptions = {}): Promise<TgMessage> {
    const button = options.button;
    return this.call<TgMessage>('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(button &&
        button.url.startsWith('https://') && {
          reply_markup: { inline_keyboard: [[{ text: button.text, url: button.url }]] },
        }),
    });
  }

  async getMe(): Promise<TgUser> {
    return this.call<TgUser>('getMe');
  }

  /** Xatoni tashlamaydigan yuborish (bot javoblari uchun). */
  async reply(chatId: number, html: string): Promise<void> {
    try {
      await this.sendMessage(chatId, html);
    } catch (err) {
      this.logger.warn(`Javob yuborilmadi (chat ${chatId}): ${String(err)}`);
    }
  }
}
