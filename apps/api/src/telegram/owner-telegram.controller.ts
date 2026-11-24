import { Controller, Get, UseGuards } from '@nestjs/common';
import type { TelegramLinkInfo } from '@taklifnoma/shared';
import { CurrentOwnerId, OwnerGuard } from '../auth/owner/owner.guard';
import { TelegramLinkService } from './telegram-link.service';

@Controller('owner/telegram')
@UseGuards(OwnerGuard)
export class OwnerTelegramController {
  constructor(private readonly links: TelegramLinkService) {}

  /** Owner barcha javoblarni olishi uchun botga ulanish havolasi. */
  @Get()
  link(@CurrentOwnerId() ownerId: string): Promise<TelegramLinkInfo> {
    return this.links.ownerLink(ownerId);
  }
}
