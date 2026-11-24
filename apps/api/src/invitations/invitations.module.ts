import { Module } from '@nestjs/common';
import { ImageProcessor } from '../media/image-processor.service';
import { MediaController } from '../media/media.controller';
import { MediaService } from '../media/media.service';
import { InvitationPresenter } from './invitation.presenter';
import { OwnerInvitationsController } from './owner-invitations.controller';
import { OwnerInvitationsService } from './owner-invitations.service';
import { PublicInvitationsController } from './public-invitations.controller';
import { RsvpStatsService } from './rsvp-stats.service';

@Module({
  controllers: [OwnerInvitationsController, PublicInvitationsController, MediaController],
  providers: [
    InvitationPresenter,
    OwnerInvitationsService,
    RsvpStatsService,
    MediaService,
    ImageProcessor,
  ],
  exports: [InvitationPresenter, RsvpStatsService],
})
export class InvitationsModule {}
