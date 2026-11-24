import { Module } from '@nestjs/common';
import { GuestsModule } from '../guests/guests.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { OwnerDashboardService } from './owner-dashboard.service';
import { OwnerController } from './owner.controller';

@Module({
  imports: [InvitationsModule, GuestsModule],
  controllers: [OwnerController],
  providers: [OwnerDashboardService],
})
export class OwnerModule {}
