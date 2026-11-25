import { Injectable } from '@nestjs/common';
import type { RsvpStats } from '@taklifnoma/shared';
import { PrismaService } from '../prisma/prisma.service';

export const EMPTY_STATS: Readonly<RsvpStats> = {
  replies: 0,
  attendingReplies: 0,
  attendingGuests: 0,
  notAttendingReplies: 0,
  pendingWishes: 0,
};

@Injectable()
export class RsvpStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir nechta taklifnoma uchun bitta so'rov bilan statistika (N+1 yo'q). */
  async forInvitations(ids: string[]): Promise<Map<string, RsvpStats>> {
    const result = new Map<string, RsvpStats>();
    if (ids.length === 0) return result;

    const rows = await this.prisma.rsvp.groupBy({
      by: ['invitationId', 'attending'],
      where: { invitationId: { in: ids } },
      _count: { _all: true },
      _sum: { guestCount: true },
    });

    const pending = await this.prisma.wish.groupBy({
      by: ['invitationId'],
      where: { invitationId: { in: ids }, status: 'PENDING' },
      _count: { _all: true },
    });

    for (const row of rows) {
      const stats = result.get(row.invitationId) ?? { ...EMPTY_STATS };
      stats.replies += row._count._all;
      if (row.attending) {
        stats.attendingReplies += row._count._all;
        stats.attendingGuests += row._sum.guestCount ?? 0;
      } else {
        stats.notAttendingReplies += row._count._all;
      }
      result.set(row.invitationId, stats);
    }
    for (const row of pending) {
      const stats = result.get(row.invitationId) ?? { ...EMPTY_STATS };
      stats.pendingWishes = row._count._all;
      result.set(row.invitationId, stats);
    }
    return result;
  }

  async forInvitation(id: string): Promise<RsvpStats> {
    return (await this.forInvitations([id])).get(id) ?? { ...EMPTY_STATS };
  }
}
