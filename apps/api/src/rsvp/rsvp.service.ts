import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Invitation, Prisma, Rsvp, Wish } from '@prisma/client';
import {
  formatUzPhone,
  normalizeUzPhone,
  RSVP_HONEYPOT_FIELD,
  RSVP_LIMITS,
  type InvitationConfig,
  type OwnWishView,
  type PublicWish,
  type RsvpSubmitParsed,
  type RsvpSubmitResult,
  type TelegramGuestSession,
  type WishAddParsed,
  wishModerationEnabled,
} from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { iso } from '../common/iso';
import { AppConfig } from '../config/app-config.service';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher } from '../telegram/notification-dispatcher.service';
import { telegramDisplayName, verifyInitData, type VerifiedInitData } from '../telegram/init-data';
import { TelegramApi } from '../telegram/telegram-api.service';
import { containsProfanity } from './profanity';
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
    private readonly config: AppConfig,
  ) {}

  async issueToken(slug: string): Promise<string> {
    const inv = await this.findActive(slug);
    return this.tokens.issue(inv.id);
  }

  /**
   * Mini App ochilganda: Telegram foydalanuvchisini tasdiqlab, uning shu taklifnomadagi
   * avvalgi javobi va tilaklarini qaytaradi (mehmon istalgan qurilmadan qayta kirsa ham taniladi).
   */
  async telegramSession(slug: string, initData: string): Promise<TelegramGuestSession> {
    const inv = await this.findActive(slug);
    const tg = this.verifyTelegram(initData);
    if (!tg) throw ApiError.unauthorized('TELEGRAM_AUTH_INVALID');

    const row = await this.prisma.rsvp.findUnique({
      where: { invitationId_telegramUserId: { invitationId: inv.id, telegramUserId: BigInt(tg.user.id) } },
      include: { wishes: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      user: { id: String(tg.user.id), name: telegramDisplayName(tg.user), username: tg.user.username ?? null },
      reply: row
        ? {
            name: row.name,
            phone: row.phone ? formatUzPhone(row.phone) : null,
            attending: row.attending,
            guestCount: row.guestCount,
            wishes: row.wishes.map(ownWish),
            createdAt: iso(row.createdAt),
          }
        : null,
    };
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
    // Telegram: initData berilgan bo'lsa imzosi to'g'ri bo'lishi shart; "faqat Telegram" rejimida majburiy.
    const tg = input.tgInitData ? this.verifyTelegram(input.tgInitData) : null;
    if (input.tgInitData && !tg) throw ApiError.unauthorized('TELEGRAM_AUTH_INVALID');
    if (config.rsvp.telegramOnly && !tg) throw ApiError.forbidden('TELEGRAM_REQUIRED');
    const tgId = tg ? BigInt(tg.user.id) : null;
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
    const moderate = wishModerationEnabled(config.rsvp);
    const nameFlagged = containsProfanity(data.name);

    const result = await this.prisma.$transaction(async (tx) => {
      const select = { id: true, name: true, telegramUserId: true };
      // Avval Telegram akkaunti bo'yicha (bitta akkaunt = bitta javob), keyin telefon bo'yicha.
      let existing = tgId
        ? await tx.rsvp.findUnique({
            where: { invitationId_telegramUserId: { invitationId: inv.id, telegramUserId: tgId } },
            select,
          })
        : null;
      if (data.phone) {
        const byPhone = await tx.rsvp.findUnique({
          where: { invitationId_phone: { invitationId: inv.id, phone: data.phone } },
          select,
        });
        if (byPhone && byPhone.id !== existing?.id) {
          // Raqam bilan faqat Telegram'siz (brauzer) javoblar bir-biriga ulanadi. Telegram ishtirok etsa
          // raqamni bilgan boshqa odam begona javobni ustidan yoza olmasligi kerak.
          if (tgId || byPhone.telegramUserId !== null) throw ApiError.conflict('PHONE_TAKEN');
          existing = byPhone;
        }
      }
      const prev = existing;

      const fields = {
        name: data.name,
        attending: data.attending,
        guestCount: data.guestCount,
        locale: input.locale,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ...(tg && { telegramUserId: tgId, telegramUsername: tg.user.username ?? null }),
      };
      const rsvp = prev
        ? await tx.rsvp.update({ where: { id: prev.id }, data: fields })
        : await tx.rsvp.create({ data: { ...fields, invitationId: inv.id, phone: data.phone, ipHash } });

      // Ism o'zgarsa: devordagi tilaklar ostida yangi ism chiqadi, shuning uchun ular qayta tekshiruvga tushadi
      // (aks holda tasdiqlangan tilak muallifini keyin haqoratli nomga almashtirish mumkin bo'lardi).
      if (prev && prev.name !== data.name && (moderate || nameFlagged)) {
        await tx.wish.updateMany({
          where: { rsvpId: rsvp.id, status: 'APPROVED' },
          data: { status: 'PENDING', ...(nameFlagged && { flagged: true }) },
        });
      }

      const wish = data.wish ? await this.addWishTx(tx, rsvp.id, inv.id, rsvp.name, data.wish, moderate) : null;

      if (targets.length) {
        await tx.notification.createMany({
          data: targets.map((target) => ({ rsvpId: rsvp.id, wishId: wish?.id ?? null, target, isUpdate: !!prev })),
        });
      }
      return { rsvp, wish, status: prev ? ('updated' as const) : ('created' as const) };
    });

    if (targets.length) this.dispatcher.kick();
    const { rsvp, wish, status } = result;
    return {
      status,
      ...(wish && { wish: ownWish(wish) }),
      // Telegram'dagilar akkaunt bo'yicha taniladi, kalit faqat brauzer uchun.
      ...(!tg && { guestToken: this.tokens.guestToken(rsvp.id) }),
    };
  }

  /**
   * Javob bergan mehmon yana tilak qo'shadi. Muallif imzolangan ma'lumot bo'yicha aniqlanadi:
   * Telegram initData yoki RSVP'da berilgan guestToken. Boshqa mehmon nomidan yozib bo'lmaydi.
   */
  async addWish(slug: string, input: WishAddParsed): Promise<OwnWishView> {
    const inv = await this.findActive(slug);
    const config = inv.config as InvitationConfig;
    if (!this.presenter.isRsvpOpen(inv)) throw ApiError.forbidden('RSVP_CLOSED');
    if (!config.rsvp.askWish) throw ApiError.forbidden('FEATURE_DISABLED');
    if (LINK_RE.test(input.text)) throw ApiError.badRequest('SPAM_DETECTED');

    const tg = input.tgInitData ? this.verifyTelegram(input.tgInitData) : null;
    if (input.tgInitData && !tg) throw ApiError.unauthorized('TELEGRAM_AUTH_INVALID');
    if (config.rsvp.telegramOnly && !tg) throw ApiError.forbidden('TELEGRAM_REQUIRED');

    const rsvp = tg
      ? await this.prisma.rsvp.findUnique({
          where: { invitationId_telegramUserId: { invitationId: inv.id, telegramUserId: BigInt(tg.user.id) } },
        })
      : await this.rsvpByGuestToken(inv.id, input.guestToken);
    // Avval javob (RSVP) berilishi kerak: tilak muallifi shu javob.
    if (!rsvp) throw ApiError.forbidden('REPLY_REQUIRED');

    const count = await this.prisma.wish.count({ where: { rsvpId: rsvp.id } });
    if (count >= RSVP_LIMITS.wishesPerGuest) {
      throw ApiError.badRequest('WISH_LIMIT_REACHED', { max: RSVP_LIMITS.wishesPerGuest });
    }

    const targets = await this.notificationTargets(inv);
    const wish = await this.prisma.$transaction(async (tx) => {
      const created = await this.addWishTx(tx, rsvp.id, inv.id, rsvp.name, input.text, wishModerationEnabled(config.rsvp));
      if (targets.length && created.isNew) {
        await tx.notification.createMany({
          data: targets.map((target) => ({ rsvpId: rsvp.id, wishId: created.id, wishOnly: true, target })),
        });
      }
      return created;
    });
    if (targets.length) this.dispatcher.kick();
    return ownWish(wish);
  }

  async wishes(slug: string): Promise<PublicWish[]> {
    const inv = await this.findActive(slug);
    if (!this.presenter.features(inv).wishesWall) return [];
    const rows = await this.prisma.wish.findMany({
      where: { invitationId: inv.id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, text: true, createdAt: true, rsvp: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.rsvp.name, wish: r.text, createdAt: iso(r.createdAt) }));
  }

  /**
   * Tilak yozish. Bir xil matn qayta yuborilsa (masalan, javobni tahrirlaganda) yangi yozuv ochilmaydi.
   * So'kinish filtri matnda yoki muallif ismida topsa, tekshiruv o'chiq bo'lsa ham tasdiqlashga tushadi.
   */
  private async addWishTx(
    tx: Prisma.TransactionClient,
    rsvpId: string,
    invitationId: string,
    authorName: string,
    text: string,
    moderate: boolean,
  ): Promise<Wish & { isNew: boolean }> {
    const same = await tx.wish.findFirst({ where: { rsvpId, text } });
    if (same) return { ...same, isNew: false };
    const flagged = containsProfanity(text) || containsProfanity(authorName);
    const wish = await tx.wish.create({
      data: { invitationId, rsvpId, text, flagged, status: moderate || flagged ? 'PENDING' : 'APPROVED' },
    });
    return { ...wish, isNew: true };
  }

  private async rsvpByGuestToken(invitationId: string, token: string | undefined): Promise<Rsvp | null> {
    const rsvpId = token ? this.tokens.verifyGuestToken(token) : null;
    if (!rsvpId) return null;
    // Kalit boshqa taklifnoma javobiga tegishli bo'lsa ham topilmaydi.
    return this.prisma.rsvp.findFirst({ where: { id: rsvpId, invitationId } });
  }

  private verifyTelegram(raw: string): VerifiedInitData | null {
    const token = this.config.get('TELEGRAM_BOT_TOKEN');
    return token ? verifyInitData(raw, token) : null;
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

/** Mehmonga faqat PENDING/APPROVED ma'lum qilinadi: yashirilgan tilak ham unga "kutilmoqda" bo'lib ko'rinadi. */
function ownWish(w: Pick<Wish, 'id' | 'text' | 'status' | 'createdAt'>): OwnWishView {
  return { id: w.id, text: w.text, status: w.status === 'APPROVED' ? 'APPROVED' : 'PENDING', createdAt: iso(w.createdAt) };
}
