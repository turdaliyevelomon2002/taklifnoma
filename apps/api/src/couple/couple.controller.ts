import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Invitation } from '@prisma/client';
import {
  guestExportQuerySchema,
  guestListQuerySchema,
  wishStatusSchema,
  type CoupleSessionInfo,
  type GuestListQueryParsed,
  type GuestPage,
  type GuestView,
  type InvitationConfig,
  type Locale,
  type WishStatusInput,
} from '@taklifnoma/shared';
import { CoupleGuard, CoupleInvitationId } from '../auth/couple/couple.guard';
import { ApiError } from '../common/api-error';
import { iso } from '../common/iso';
import { coupleNames } from '../common/localize';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { buildGuestsWorkbook } from '../guests/guests-excel';
import { GuestsService } from '../guests/guests.service';
import { t } from '../i18n/translator';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { RsvpStatsService } from '../invitations/rsvp-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Juftlik admin paneli: faqat o'z taklifnomasi (invitationId sessiya cookie'sidan olinadi). */
@Controller('couple')
@UseGuards(CoupleGuard)
export class CoupleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: InvitationPresenter,
    private readonly stats: RsvpStatsService,
    private readonly telegram: TelegramLinkService,
    private readonly guests: GuestsService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@CoupleInvitationId() invitationId: string): Promise<CoupleSessionInfo> {
    const inv = await this.invitation(invitationId);
    return {
      invitationId: inv.id,
      slug: inv.slug,
      status: inv.status,
      package: inv.package,
      eventDate: iso(inv.eventDate),
      timezone: (inv.config as InvitationConfig).timezone,
      couple: (inv.config as InvitationConfig).couple,
      features: this.presenter.features(inv),
      stats: await this.stats.forInvitation(inv.id),
      publicUrl: this.presenter.publicUrl(inv.slug),
      telegramLinked: !!inv.coupleChatId,
      telegramLinkUrl: this.telegram.coupleLink(inv.telegramLinkCode),
    };
  }

  @Get('guests')
  @Header('Cache-Control', 'no-store')
  list(
    @CoupleInvitationId() invitationId: string,
    @Query(new ZodValidationPipe(guestListQuerySchema)) query: GuestListQueryParsed,
  ): Promise<GuestPage> {
    return this.guests.list(invitationId, query);
  }

  /** Tilakni tasdiqlash (devorga chiqadi) yoki yashirish. */
  @Patch('wishes/:id')
  setWishStatus(
    @CoupleInvitationId() invitationId: string,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => ApiError.notFound() })) id: string,
    @Body(new ZodValidationPipe(wishStatusSchema)) body: WishStatusInput,
  ): Promise<GuestView> {
    return this.guests.setWishStatus(invitationId, id, body.status);
  }

  @Delete('guests/:id')
  @HttpCode(204)
  remove(
    @CoupleInvitationId() invitationId: string,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => ApiError.notFound() })) id: string,
  ): Promise<void> {
    return this.guests.remove(invitationId, id);
  }

  /** Excel: faqat paketida excelExport yoqilgan bo'lsa. */
  @Get('guests/export')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async export(
    @CoupleInvitationId() invitationId: string,
    @Query(new ZodValidationPipe(guestExportQuerySchema)) query: { lang: Locale },
  ): Promise<StreamableFile> {
    const inv = await this.invitation(invitationId);
    if (!this.presenter.features(inv).excelExport) {
      throw ApiError.forbidden('FEATURE_DISABLED', { feature: 'excelExport' });
    }
    const config = inv.config as InvitationConfig;
    const [guests, stats] = await Promise.all([
      this.guests.all(inv.id),
      this.stats.forInvitation(inv.id),
    ]);
    const buffer = await buildGuestsWorkbook({
      locale: query.lang,
      timezone: config.timezone,
      coupleNames: coupleNames(config, query.lang),
      guests,
      stats,
    });
    const fileName = `${t(query.lang, 'export.filePrefix')}-${inv.slug}.xlsx`;
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: `attachment; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  private async invitation(id: string): Promise<Invitation> {
    const inv = await this.prisma.invitation.findUnique({ where: { id } });
    // Taklifnoma o'chirilgan bo'lsa sessiya ham yaroqsiz.
    if (!inv) throw ApiError.unauthorized();
    return inv;
  }
}
