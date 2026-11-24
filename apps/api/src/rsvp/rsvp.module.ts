import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PublicRsvpController } from './public-rsvp.controller';
import { RsvpTokenService } from './rsvp-token.service';
import { RsvpService } from './rsvp.service';

@Module({
  imports: [InvitationsModule, TelegramModule],
  controllers: [PublicRsvpController],
  providers: [RsvpService, RsvpTokenService],
})
export class RsvpModule {}
