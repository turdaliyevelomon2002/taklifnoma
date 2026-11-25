import { Injectable } from '@nestjs/common';
import type { Prisma, Rsvp, Wish } from '@prisma/client';
import type { GuestListQueryParsed, GuestPage, GuestView, Locale, WishStatusInput } from '@taklifnoma/shared';
import { ApiError } from '../common/api-error';
import { iso } from '../common/iso';
import { PrismaService } from '../prisma/prisma.service';

const withWishes = { wishes: { orderBy: { createdAt: 'asc' } } } as const satisfies Prisma.RsvpInclude;

/** Excel eksportida bir martada ko'pi bilan shuncha qator (to'y uchun yetarlicha katta). */
export const EXPORT_MAX_ROWS = 5_000;

/**
 * Bitta taklifnomaning mehmonlari. Har bir metod invitationId oladi va faqat shu
 * taklifnoma doirasida ishlaydi: boshqa taklifnoma javobiga ID orqali kirib bo'lmaydi.
 */
@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(invitationId: string, query: GuestListQueryParsed): Promise<GuestPage> {
    const where = this.where(invitationId, query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.rsvp.count({ where }),
      this.prisma.rsvp.findMany({
        where,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: withWishes,
      }),
    ]);
    return { items: rows.map(toView), total, page: query.page, pageSize: query.pageSize };
  }

  /** Eksport uchun: filtrsiz, keladiganlar avval, keyin sana bo'yicha. */
  async all(invitationId: string): Promise<GuestView[]> {
    const rows = await this.prisma.rsvp.findMany({
      where: { invitationId },
      orderBy: [{ attending: 'desc' }, { createdAt: 'asc' }],
      take: EXPORT_MAX_ROWS,
      include: withWishes,
    });
    return rows.map(toView);
  }

  /** Tilakni tasdiqlash (devorga chiqadi) yoki yashirish. Muallifning yangilangan kartasi qaytadi. */
  async setWishStatus(invitationId: string, wishId: string, status: WishStatusInput['status']): Promise<GuestView> {
    const wish = await this.prisma.wish.findFirst({ where: { id: wishId, invitationId }, select: { rsvpId: true } });
    if (!wish) throw ApiError.notFound();
    await this.prisma.wish.update({ where: { id: wishId }, data: { status } });
    return toView(await this.prisma.rsvp.findUniqueOrThrow({ where: { id: wish.rsvpId }, include: withWishes }));
  }

  /** Spam yoki takroriy javobni o'chirish (bog'liq bildirishnomalar cascade bilan o'chadi). */
  async remove(invitationId: string, rsvpId: string): Promise<void> {
    const { count } = await this.prisma.rsvp.deleteMany({ where: { id: rsvpId, invitationId } });
    if (count === 0) throw ApiError.notFound();
  }

  private where(invitationId: string, query: GuestListQueryParsed): Prisma.RsvpWhereInput {
    const where: Prisma.RsvpWhereInput = { invitationId };
    if (query.filter === 'attending') where.attending = true;
    if (query.filter === 'declined') where.attending = false;
    if (query.filter === 'pendingWishes') where.wishes = { some: { status: 'PENDING' } };
    if (query.q) {
      const digits = query.q.replace(/\D/g, '');
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { wishes: { some: { text: { contains: query.q, mode: 'insensitive' } } } },
        // Telefon raqami bo'yicha: kamida 3 ta raqam kiritilganda.
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ];
    }
    return where;
  }

  private orderBy(sort: GuestListQueryParsed['sort']): Prisma.RsvpOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }
}

function toView(r: Rsvp & { wishes: Wish[] }): GuestView {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    attending: r.attending,
    guestCount: r.guestCount,
    wishes: r.wishes.map((w) => ({
      id: w.id,
      text: w.text,
      status: w.status,
      flagged: w.flagged,
      createdAt: iso(w.createdAt),
    })),
    telegram: r.telegramUserId ? { id: String(r.telegramUserId), username: r.telegramUsername } : null,
    locale: r.locale as Locale,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}
