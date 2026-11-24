import { Controller, Get, Header, Param } from '@nestjs/common';
import { isValidSlug, type PublicInvitation } from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationPresenter } from './invitation.presenter';

@Controller('public/invitations')
export class PublicInvitationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: InvitationPresenter,
  ) {}

  /** Faqat ACTIVE va muddati o'tmagan taklifnomalar ko'rinadi. */
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  async get(@Param('slug') slug: string): Promise<PublicInvitation> {
    if (!isValidSlug(slug)) throw ApiError.notFound();
    const now = new Date();
    const inv = await this.prisma.invitation.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { media: true },
    });
    if (!inv) throw ApiError.notFound();
    return this.presenter.publicView(inv, now);
  }
}
