import { Injectable } from '@nestjs/common';
import {
  DASHBOARD_UPCOMING_DAYS,
  INVITATION_STATUSES,
  type OwnerDashboard,
} from '@taklifnoma/shared';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { EMPTY_STATS, RsvpStatsService } from '../invitations/rsvp-stats.service';
import { PrismaService } from '../prisma/prisma.service';

/** Biznes Toshkent vaqtida ishlaydi (UTC+5, yozgi vaqt yo'q): "shu oy" shu bo'yicha. */
const BUSINESS_UTC_OFFSET_HOURS = 5;

export function startOfBusinessMonth(now: Date): Date {
  const local = new Date(now.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - BUSINESS_UTC_OFFSET_HOURS * 3600_000,
  );
}

@Injectable()
export class OwnerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: InvitationPresenter,
    private readonly stats: RsvpStatsService,
  ) {}

  async get(now = new Date()): Promise<OwnerDashboard> {
    const until = new Date(now.getTime() + DASHBOARD_UPCOMING_DAYS * 24 * 3600_000);
    const [byStatus, upcomingRows, revenueTotal, revenueMonth, unpaid] = await this.prisma.$transaction([
      this.prisma.invitation.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { status: 'ACTIVE', eventDate: { gte: now, lte: until } },
        orderBy: { eventDate: 'asc' },
        take: 10,
      }),
      this.prisma.invitation.aggregate({ _sum: { price: true }, where: { paidAt: { not: null } } }),
      this.prisma.invitation.aggregate({
        _sum: { price: true },
        where: { paidAt: { gte: startOfBusinessMonth(now) } },
      }),
      this.prisma.invitation.count({
        where: { paidAt: null, price: { gt: 0 }, status: { not: 'ARCHIVED' } },
      }),
    ]);

    const counts = Object.fromEntries(INVITATION_STATUSES.map((s) => [s, 0])) as OwnerDashboard['counts'];
    counts.total = 0;
    for (const row of byStatus) {
      const n = (row._count as { _all: number })._all;
      counts[row.status] = n;
      counts.total += n;
    }

    const stats = await this.stats.forInvitations(upcomingRows.map((r) => r.id));
    return {
      counts,
      upcoming: upcomingRows.map((r) => this.presenter.listItem(r, stats.get(r.id) ?? { ...EMPTY_STATS })),
      revenue: {
        thisMonth: revenueMonth._sum.price ?? 0,
        total: revenueTotal._sum.price ?? 0,
      },
      unpaid,
    };
  }
}
