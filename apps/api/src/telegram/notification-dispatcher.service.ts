import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import type { InvitationConfig } from '@taklifnoma/shared';
import { AppConfig } from '../config/app-config.service';
import { t } from '../i18n/translator';
import { InvitationPresenter } from '../invitations/invitation.presenter';
import { RsvpStatsService } from '../invitations/rsvp-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildRsvpMessage } from './rsvp-message';
import { coupleNames } from '../common/localize';
import { TelegramApi, TelegramApiError } from './telegram-api.service';

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 20;
/** Ushlab turish muddati: jarayon yiqilsa, yozuv shu vaqtdan keyin qayta olinadi. */
const LEASE_SECONDS = 120;
/** attempts (1 dan boshlab) -> keyingi urinishgacha kutish. */
const BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

class PermanentFailure extends Error {}

type NotificationWithRsvp = Prisma.NotificationGetPayload<{
  include: { rsvp: { include: { invitation: true } } };
}>;

/**
 * Outbox: RSVP saqlanganda shu tranzaksiyada Notification yoziladi, bu servis esa
 * ularni Telegram'ga yuboradi. Telegram ishlamasa ham javob yo'qolmaydi, keyinroq qayta urinadi.
 * Bir nechta API instansiyasi bo'lsa ham FOR UPDATE SKIP LOCKED tufayli xabar takrorlanmaydi.
 */
@Injectable()
export class NotificationDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private rerun = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApi,
    private readonly stats: RsvpStatsService,
    private readonly presenter: InvitationPresenter,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.api.enabled || this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => this.kick(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Yangi RSVP'dan keyin darhol yuborish (5 soniya kutmasdan). */
  kick(): void {
    if (!this.api.enabled) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    void this.drain().finally(() => {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        this.kick();
      }
    });
  }

  private async drain(): Promise<void> {
    try {
      for (let round = 0; round < 10; round++) {
        const ids = await this.claim();
        if (ids.length === 0) return;
        for (const id of ids) await this.process(id);
      }
    } catch (err) {
      this.logger.error(`Dispatcher xatosi: ${String(err)}`);
    }
  }

  private async claim(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE notifications
         SET "nextRetryAt" = now() + make_interval(secs => ${LEASE_SECONDS}),
             attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM notifications
          WHERE status = 'PENDING' AND "nextRetryAt" <= now()
          ORDER BY "createdAt"
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
       )
      RETURNING id`;
    return rows.map((r) => r.id);
  }

  private async process(id: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({
      where: { id },
      include: { rsvp: { include: { invitation: true } } },
    });
    if (!n) return;

    try {
      await this.send(n);
      await this.prisma.notification.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
    } catch (err) {
      await this.fail(n, err);
    }
  }

  private async send(n: NotificationWithRsvp): Promise<void> {
    const { rsvp } = n;
    const inv = rsvp.invitation;
    const config = inv.config as InvitationConfig;
    const stats = await this.stats.forInvitation(inv.id);
    const guest = {
      name: rsvp.name,
      phone: rsvp.phone,
      attending: rsvp.attending,
      guestCount: rsvp.guestCount,
      wish: rsvp.wish,
    };

    if (n.target === 'COUPLE') {
      if (!inv.coupleChatId) throw new PermanentFailure('couple_not_linked');
      if (!this.presenter.features(inv).telegramNotify) throw new PermanentFailure('feature_disabled');
      const locale = config.defaultLocale;
      const text = buildRsvpMessage({
        locale,
        isUpdate: n.isUpdate,
        coupleNames: coupleNames(config, locale),
        guest,
        stats,
      });
      await this.api.sendMessage(inv.coupleChatId, text, {
        button: {
          text: t(locale, 'telegram.rsvp.openPanel'),
          url: `${this.presenter.publicUrl(inv.slug)}/admin`,
        },
      });
      return;
    }

    const owners = await this.prisma.owner.findMany({
      where: { telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    if (owners.length === 0) throw new PermanentFailure('owner_not_linked');
    const text = buildRsvpMessage({
      locale: 'uz',
      isUpdate: n.isUpdate,
      coupleNames: coupleNames(config, 'uz'),
      slug: inv.slug,
      guest,
      stats,
    });
    for (const owner of owners) await this.api.sendMessage(owner.telegramChatId!, text);
  }

  private async fail(n: Notification, err: unknown): Promise<void> {
    const permanent =
      err instanceof PermanentFailure || (err instanceof TelegramApiError && err.isPermanent);
    const exhausted = n.attempts >= MAX_ATTEMPTS;
    const message = err instanceof Error ? err.message : String(err);

    let nextRetryAt: Date | undefined;
    if (!permanent && !exhausted) {
      const retryAfterMs =
        err instanceof TelegramApiError && err.retryAfterSec ? err.retryAfterSec * 1000 : 0;
      const backoff = BACKOFF_MS[Math.min(n.attempts - 1, BACKOFF_MS.length - 1)]!;
      nextRetryAt = new Date(Date.now() + Math.max(backoff, retryAfterMs));
    }

    await this.prisma.notification.update({
      where: { id: n.id },
      data: {
        status: nextRetryAt ? 'PENDING' : 'FAILED',
        lastError: message.slice(0, 500),
        ...(nextRetryAt && { nextRetryAt }),
      },
    });
    const level = nextRetryAt ? 'warn' : 'error';
    this.logger[level](
      `Notification ${n.id} (${n.target}) yuborilmadi [${n.attempts}/${MAX_ATTEMPTS}]: ${message}`,
    );
  }
}
