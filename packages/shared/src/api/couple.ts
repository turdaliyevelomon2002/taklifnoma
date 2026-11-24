import type { InvitationStatus, PackageType } from '../enums';
import type { FeatureFlags } from '../features';
import type { InvitationConfig } from '../invitation-config';
import type { RsvpStats } from './invitations';

export interface CoupleSessionInfo {
  invitationId: string;
  slug: string;
  status: InvitationStatus;
  package: PackageType;
  eventDate: string;
  /** Taklifnoma vaqt zonasi (sanalarni ko'rsatish uchun). */
  timezone: string;
  couple: InvitationConfig['couple'];
  features: FeatureFlags;
  stats: RsvpStats;
  publicUrl: string;
  telegramLinked: boolean;
  telegramLinkUrl: string | null;
}
