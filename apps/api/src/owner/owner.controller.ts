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
import {
  guestExportQuerySchema,
  guestListQuerySchema,
  wishVisibilitySchema,
  type GuestListQueryParsed,
  type GuestPage,
  type GuestView,
  type InvitationConfig,
  type Locale,
  type OwnerDashboard,
  type WishVisibilityInput,
} from '@taklifnoma/shared';
import { OwnerGuard } from '../auth/owner/owner.guard';
import { ApiError } from '../common/api-error';
import { coupleNames } from '../common/localize';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { buildGuestsWorkbook } from '../guests/guests-excel';
import { GuestsService } from '../guests/guests.service';
import { t } from '../i18n/translator';
import { RsvpStatsService } from '../invitations/rsvp-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerDashboardService } from './owner-dashboard.service';

const uuid = new ParseUUIDPipe({ exceptionFactory: () => ApiError.notFound() });
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('owner')
@UseGuards(OwnerGuard)
export class OwnerController {
  constructor(
    private readonly dashboard: OwnerDashboardService,
    private readonly guests: GuestsService,
    private readonly stats: RsvpStatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  getDashboard(): Promise<OwnerDashboard> {
    return this.dashboard.get();
  }

  // --- Mehmonlar (qo'llab-quvvatlash uchun: juftlik bilan bir xil imkoniyatlar) ---

  @Get('invitations/:id/guests')
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('id', uuid) id: string,
    @Query(new ZodValidationPipe(guestListQuerySchema)) query: GuestListQueryParsed,
  ): Promise<GuestPage> {
    await this.ensureExists(id);
    return this.guests.list(id, query);
  }

  @Patch('invitations/:id/guests/:rsvpId/wish')
  setWishHidden(
    @Param('id', uuid) id: string,
    @Param('rsvpId', uuid) rsvpId: string,
    @Body(new ZodValidationPipe(wishVisibilitySchema)) body: WishVisibilityInput,
  ): Promise<GuestView> {
    return this.guests.setWishHidden(id, rsvpId, body.hidden);
  }

  @Delete('invitations/:id/guests/:rsvpId')
  @HttpCode(204)
  remove(@Param('id', uuid) id: string, @Param('rsvpId', uuid) rsvpId: string): Promise<void> {
    return this.guests.remove(id, rsvpId);
  }

  /** Owner uchun paketdan qat'i nazar ochiq (qo'llab-quvvatlash). */
  @Get('invitations/:id/guests/export')
  async export(
    @Param('id', uuid) id: string,
    @Query(new ZodValidationPipe(guestExportQuerySchema)) query: { lang: Locale },
  ): Promise<StreamableFile> {
    const inv = await this.prisma.invitation.findUnique({ where: { id } });
    if (!inv) throw ApiError.notFound();
    const config = inv.config as InvitationConfig;
    const [guests, stats] = await Promise.all([this.guests.all(id), this.stats.forInvitation(id)]);
    const buffer = await buildGuestsWorkbook({
      locale: query.lang,
      timezone: config.timezone,
      coupleNames: coupleNames(config, query.lang),
      guests,
      stats,
    });
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: `attachment; filename="${t(query.lang, 'export.filePrefix')}-${inv.slug}.xlsx"`,
      length: buffer.length,
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.invitation.count({ where: { id } });
    if (!found) throw ApiError.notFound();
  }
}
