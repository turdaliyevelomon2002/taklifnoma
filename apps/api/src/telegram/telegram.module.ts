import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { OwnerTelegramController } from './owner-telegram.controller';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [InvitationsModule],
  controllers: [TelegramWebhookController, OwnerTelegramController],
  providers: [TelegramBotService, NotificationDispatcher],
  exports: [NotificationDispatcher],
})
export class TelegramModule {}
