import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Invitation, Prisma } from '@prisma/client';
import {
  normalizeUzPhone,
  RSVP_HONEYPOT_FIELD,
  RSVP_LIMITS,
  type InvitationConfig,
  type PublicWish,
  type RsvpSubmitParsed,
  type RsvpSubmitResult,
} from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { iso } from '../common/iso';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher } from '../telegram/notification-dispatcher.service';
import { TelegramApi } from '../telegram/telegram-api.service';
import { RsvpTokenService } from './rsvp-token.service';

/** Havola yoki domen: tilak va ismda spam belgisi. */
const LINK_RE = /(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{5,}|\b[a-z0-9-]{2,}\.(com|ru|uz|net|org|io|me|xyz|top|site)\b)/i;

export interface RsvpRequestMeta {
  ip: string;
  userAgent?: string;
}

@Injectable()
export class RsvpService {
  private readonly logger = new Logger(RsvpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: InvitationPresenter,
    private readonly tokens: RsvpTokenService,
    private readonly telegram: TelegramApi,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async issueToken(slug: string): Promise<string> {
    const inv = await this.findActive(slug);
    return this.tokens.issue(inv.id);
  }

  async submit(slug: string, input: RsvpSubmitParsed, meta: RsvpRequestMeta): Promise<RsvpSubmitResult> {
    const inv = await this.findActive(slug);
    const config = inv.config as InvitationConfig;

    // 1. Honeypot: botga "muvaffaqiyat" ko'rsatamiz, lekin hech narsa saqlamaymiz.
    if (input[RSVP_HONEYPOT_FIELD]) {
      this.logger.warn(`Honeypot ishladi: /${slug}`);
      return { status: 'created' };
    }

    // 2. Forma tokeni (vaqt va imzo).
    const check = this.tokens.verify(input.formToken, inv.id);
    if (check === 'too_fast') throw ApiError.badRequest('SPAM_DETECTED');
    if (check !== 'ok') throw ApiError.badRequest('FORM_EXPIRED');

    // 3. Biznes qoidalari.
    if (!this.presenter.isRsvpOpen(inv)) throw ApiError.forbidden('RSVP_CLOSED');
    const data = this.normalize(input, config);

    // 4. Bitta IP'dan kunlik limit (throttler'dan tashqari, taklifnoma darajasida).
    const ipHash = this.tokens.hashIp(meta.ip);
    const recent = await this.prisma.rsvp.count({
      where: { invitationId: inv.id, ipHash, createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } },
    });
    if (recent >= RSVP_LIMITS.perIpPerDay) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED');
    }

    // 5. Saqlash + outbox (bitta tranzaksiyada).
    const targets = await this.notificationTargets(inv);
    const status = await this.prisma.$transaction(async (tx) => {
      const existing = data.phone
        ? await tx.rsvp.findUnique({
            where: { invitationId_phone: { invitationId: inv.id, phone: data.phone } },
            select: { id: true },
          })
        : null;

      const fields = {
        name: data.name,
        attending: data.attending,
        guestCount: data.guestCount,
        wish: data.wish,
        locale: input.locale,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      };

      const rsvp = existing
        ? await tx.rsvp.update({ where: { id: existing.id }, data: fields })
        : await tx.rsvp.create({
            data: { ...fields, invitationId: inv.id, phone: data.phone, ipHash },
          });

      if (targets.length) {
        await tx.notification.createMany({
          data: targets.map((target) => ({ rsvpId: rsvp.id, target, isUpdate: !!existing })),
        });
      }
      return existing ? ('updated' as const) : ('created' as const);
    });

    if (targets.length) this.dispatcher.kick();
    return { status };
  }

  async wishes(slug: string): Promise<PublicWish[]> {
    const inv = await this.findActive(slug);
    if (!this.presenter.features(inv).wishesWall) return [];
    const rows = await this.prisma.rsvp.findMany({
      where: { invitationId: inv.id, wish: { not: null }, wishHidden: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, name: true, wish: true, createdAt: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, wish: r.wish!, createdAt: iso(r.createdAt) }));
  }

  private normalize(input: RsvpSubmitParsed, config: InvitationConfig) {
    const rules = config.rsvp;

    let phone: string | null = null;
    if (input.phone) {
      phone = normalizeUzPhone(input.phone);
      if (!phone) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', {
          issues: [{ path: 'phone', code: 'custom', message: 'invalid_phone' }],
        });
      }
    } else if (rules.askPhone) {
      throw ApiError.badRequest('PHONE_REQUIRED');
    }

    const guestCount = input.attending ? input.guestCount : 0;
    if (input.attending && guestCount < 1) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', {
        issues: [{ path: 'guestCount', code: 'too_small', message: 'min_1' }],
      });
    }
    if (guestCount > rules.maxGuestsPerReply) {
      throw ApiError.badRequest('TOO_MANY_GUESTS', { max: rules.maxGuestsPerReply });
    }

    const wish = rules.askWish && input.wish ? input.wish : null;
    if (LINK_RE.test(input.name) || (wish && LINK_RE.test(wish))) {
      throw ApiError.badRequest('SPAM_DETECTED');
    }

    return { name: input.name, phone, attending: input.attending, guestCount, wish };
  }

  /** Kimga xabar yuborish kerak (telegram o'chiq bo'lsa hech kimga). */
  private async notificationTargets(inv: Invitation): Promise<Prisma.NotificationCreateManyInput['target'][]> {
    if (!this.telegram.enabled) return [];
    const targets: Prisma.NotificationCreateManyInput['target'][] = [];
    if (inv.coupleChatId && this.presenter.features(inv).telegramNotify) targets.push('COUPLE');
    const ownerLinked = await this.prisma.owner.count({ where: { telegramChatId: { not: null } } });
    if (ownerLinked > 0) targets.push('OWNER');
    return targets;
  }

  private async findActive(slug: string): Promise<Invitation> {
    const inv = await this.prisma.invitation.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!inv) throw ApiError.notFound();
    return inv;
  }
}
