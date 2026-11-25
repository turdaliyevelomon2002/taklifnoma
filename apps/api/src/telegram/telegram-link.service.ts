import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { TelegramLinkInfo } from '@taklifnoma/shared';
import { randomCode } from '../common/crypto';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramApi } from './telegram-api.service';

/** Deep-link start parametri prefikslari: c_ = juftlik (couple), o_ = owner. */
export const START_PREFIX = { couple: 'c_', owner: 'o_' } as const;

/**
 * Botga ulanish havolalari: https://t.me/<bot>?start=c_<kod>
 * Bot username'i ishga tushishda getMe orqali bir marta olinadi.
 */
@Injectable()
export class TelegramLinkService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramLinkService.name);
  private username: string | null = null;

  constructor(
    private readonly api: TelegramApi,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.api.enabled) {
      this.logger.log('Telegram o\'chiq (TELEGRAM_BOT_TOKEN berilmagan)');
      return;
    }
    try {
      const me = await this.api.getMe();
      this.username = me.username ?? null;
      this.logger.log(`Telegram bot: @${this.username}`);
    } catch (err) {
      this.logger.error(`Telegram getMe xatosi: ${String(err)}`);
    }
  }

  get available(): boolean {
    return this.api.enabled && this.username !== null;
  }

  coupleLink(telegramLinkCode: string | null): string | null {
    return this.link(START_PREFIX.couple, telegramLinkCode);
  }

  async ownerLink(ownerId: string): Promise<TelegramLinkInfo> {
    let owner = await this.prisma.owner.findUniqueOrThrow({ where: { id: ownerId } });
    if (!owner.telegramLinkCode) {
      owner = await this.prisma.owner.update({
        where: { id: ownerId },
        data: { telegramLinkCode: randomCode(16) },
      });
    }
    return {
      url: this.link(START_PREFIX.owner, owner.telegramLinkCode),
      linked: !!owner.telegramChatId,
    };
  }

  /** Mehmonlar uchun Mini App havolasi: https://t.me/<bot>/<ilova>?startapp=<slug> */
  miniAppLink(slug: string): string | null {
    const app = this.config.get('TELEGRAM_MINIAPP_NAME');
    if (!this.username || !app) return null;
    return `https://t.me/${this.username}/${app}?startapp=${slug}`;
  }

  private link(prefix: string, code: string | null): string | null {
    if (!this.username || !code) return null;
    return `https://t.me/${this.username}?start=${prefix}${code}`;
  }
}
