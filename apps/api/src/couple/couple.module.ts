import { Module } from '@nestjs/common';
import { GuestsModule } from '../guests/guests.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { CoupleController } from './couple.controller';

@Module({
  imports: [InvitationsModule, GuestsModule],
  controllers: [CoupleController],
})
export class CoupleModule {}
