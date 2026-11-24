import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  getPrimaryEvent,
  isValidSlug,
  type ChangeStatusInput,
  type CoupleAccessCredentials,
  type CreateInvitationInput,
  type CreateInvitationResult,
  type InvitationConfig,
  type InvitationDetail,
  type InvitationListItem,
  type ListInvitationsQuery,
  type Paginated,
  type UpdateInvitationInput,
} from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { hashSecret, randomCode, randomPin, randomToken, sha256 } from '../common/crypto';
import { AppConfig } from '../config/app-config.service';
import type { MediaVariantKeys } from './invitation.presenter';
import { InvitationPresenter } from './invitation.presenter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EMPTY_STATS, RsvpStatsService } from './rsvp-stats.service';

/** To'ydan keyin sahifa qancha vaqt ochiq turadi. */
const KEEP_ALIVE_DAYS_AFTER_EVENT = 60;

@Injectable()
export class OwnerInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: InvitationPresenter,
    private readonly stats: RsvpStatsService,
    private readonly storage: StorageService,
    private readonly config: AppConfig,
  ) {}

  async list(query: ListInvitationsQuery): Promise<Paginated<InvitationListItem>> {
    const where: Prisma.InvitationWhereInput = {
      status: query.status,
      package: query.package,
      ...(query.q && {
        OR: [
          { slug: { contains: query.q, mode: 'insensitive' } },
          { customerName: { contains: query.q, mode: 'insensitive' } },
          { customerPhone: { contains: query.q.replace(/\s/g, '') } },
        ],
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invitation.count({ where }),
      this.prisma.invitation.findMany({
        where,
        orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const stats = await this.stats.forInvitations(rows.map((r) => r.id));
    return {
      items: rows.map((r) => this.presenter.listItem(r, stats.get(r.id) ?? { ...EMPTY_STATS })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async get(id: string): Promise<InvitationDetail> {
    const inv = await this.prisma.invitation.findUnique({ where: { id }, include: { media: true } });
    if (!inv) throw ApiError.notFound();
    return this.presenter.detail(inv, await this.stats.forInvitation(id));
  }

  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const normalized = slug.trim().toLowerCase();
    if (!isValidSlug(normalized)) return false;
    const existing = await this.prisma.invitation.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });
    return !existing || existing.id === excludeId;
  }

  async create(input: CreateInvitationInput): Promise<CreateInvitationResult> {
    if (!(await this.isSlugAvailable(input.slug))) throw ApiError.conflict('SLUG_TAKEN');

    const secrets = await this.generateAccess();
    const dates = this.datesFromConfig(input.config);

    const inv = await this.withSlugConflict(() =>
      this.prisma.invitation.create({
        data: {
          slug: input.slug,
          templateKey: input.templateKey,
          package: input.package,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          price: input.price,
          notes: input.notes,
          config: input.config as Prisma.InputJsonValue,
          featureOverrides: input.featureOverrides ?? Prisma.DbNull,
          ...dates,
          adminTokenHash: secrets.tokenHash,
          adminPinHash: secrets.pinHash,
          telegramLinkCode: randomCode(16),
        },
        include: { media: true },
      }),
    );

    return {
      invitation: this.presenter.detail(inv, { ...EMPTY_STATS }),
      access: this.credentials(inv.slug, secrets),
    };
  }

  async update(id: string, input: UpdateInvitationInput): Promise<InvitationDetail> {
    const current = await this.prisma.invitation.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw ApiError.notFound();
    if (input.slug && !(await this.isSlugAvailable(input.slug, id))) {
      throw ApiError.conflict('SLUG_TAKEN');
    }

    const data: Prisma.InvitationUpdateInput = {
      slug: input.slug,
      templateKey: input.templateKey,
      package: input.package,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      price: input.price,
      notes: input.notes,
      paidAt: input.paidAt === undefined ? undefined : input.paidAt ? new Date(input.paidAt) : null,
    };
    if (input.config) {
      data.config = input.config as Prisma.InputJsonValue;
      Object.assign(data, this.datesFromConfig(input.config));
    }
    if (input.featureOverrides !== undefined) {
      data.featureOverrides = input.featureOverrides ?? Prisma.DbNull;
    }

    await this.withSlugConflict(() => this.prisma.invitation.update({ where: { id }, data }));
    return this.get(id);
  }

  async changeStatus(id: string, input: ChangeStatusInput): Promise<InvitationDetail> {
    const inv = await this.prisma.invitation.findUnique({
      where: { id },
      select: { publishedAt: true },
    });
    if (!inv) throw ApiError.notFound();
    await this.prisma.invitation.update({
      where: { id },
      data: {
        status: input.status,
        publishedAt: input.status === 'ACTIVE' && !inv.publishedAt ? new Date() : undefined,
      },
    });
    return this.get(id);
  }

  /** Yangi havola va PIN; eski havola, PIN va barcha juftlik sessiyalari bekor bo'ladi. */
  async regenerateAccess(id: string): Promise<CoupleAccessCredentials> {
    const secrets = await this.generateAccess();
    const inv = await this.prisma.invitation.update({
      where: { id },
      data: {
        adminTokenHash: secrets.tokenHash,
        adminPinHash: secrets.pinHash,
        pinFailedCount: 0,
        pinLockedUntil: null,
        accessVersion: { increment: 1 },
      },
      select: { slug: true },
    });
    return this.credentials(inv.slug, secrets);
  }

  async remove(id: string): Promise<void> {
    const inv = await this.prisma.invitation.findUnique({
      where: { id },
      include: { media: { select: { storageKey: true, variants: true } } },
    });
    if (!inv) throw ApiError.notFound();
    await this.prisma.invitation.delete({ where: { id } });
    const keys = inv.media.flatMap((m) => [
      m.storageKey,
      ...Object.values((m.variants ?? {}) as MediaVariantKeys),
    ]);
    await this.storage.deleteMany([...new Set(keys)]);
  }

  async preview(id: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { id }, include: { media: true } });
    if (!inv) throw ApiError.notFound();
    return this.presenter.publicView(inv);
  }

  private datesFromConfig(config: InvitationConfig): { eventDate: Date; expiresAt: Date } {
    const eventDate = new Date(getPrimaryEvent(config).startsAt);
    const lastEvent = Math.max(
      ...config.events.map((e) => Date.parse(e.endsAt ?? e.startsAt)),
    );
    const expiresAt = new Date(lastEvent + KEEP_ALIVE_DAYS_AFTER_EVENT * 24 * 3600 * 1000);
    return { eventDate, expiresAt };
  }

  private async generateAccess() {
    const token = randomToken(32);
    const pin = randomPin(6);
    return { token, pin, tokenHash: sha256(token), pinHash: await hashSecret(pin) };
  }

  private credentials(slug: string, secrets: { token: string; pin: string }): CoupleAccessCredentials {
    // Token URL fragmentida (#): server/proksi loglariga tushmaydi.
    const adminUrl = `${this.config.get('PUBLIC_WEB_URL')}/${slug}/admin#k=${secrets.token}`;
    return { adminUrl, pin: secrets.pin };
  }

  /** Oldindan tekshiruv va yozish orasidagi poyga holatida ham to'g'ri xato kodi qaytadi. */
  private async withSlugConflict<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        String(err.meta?.target ?? '').includes('slug')
      ) {
        throw ApiError.conflict('SLUG_TAKEN');
      }
      throw err;
    }
  }
}
