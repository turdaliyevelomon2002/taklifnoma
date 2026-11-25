import { Body, Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  isValidSlug,
  rsvpSubmitSchema,
  telegramSessionSchema,
  wishAddSchema,
  type PublicWish,
  type RsvpFormToken,
  type RsvpSubmitParsed,
  type RsvpSubmitResult,
  type TelegramGuestSession,
  type TelegramSessionInput,
  type OwnWishView,
  type WishAddParsed,
} from '@taklifnoma/shared';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RsvpService } from './rsvp.service';

@Controller('public/invitations/:slug')
export class PublicRsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  /** Forma ochilganda olinadi. Keshlanmaydi: har bir token o'z vaqt belgisiga ega. */
  @Get('rsvp-token')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async token(@Param('slug') slug: string): Promise<RsvpFormToken> {
    return { token: await this.rsvp.issueToken(this.slug(slug)) };
  }

  /**
   * Himoya qatlamlari: IP bo'yicha rate limit (5/daqiqa) -> Zod validatsiya -> honeypot ->
   * imzolangan vaqt tokeni -> config qoidalari -> kunlik IP limiti.
   */
  @Post('rsvp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(rsvpSubmitSchema)) body: RsvpSubmitParsed,
    @Req() req: Request,
  ): Promise<RsvpSubmitResult> {
    return this.rsvp.submit(this.slug(slug), body, {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.get('user-agent'),
    });
  }

  /** Mini App: Telegram foydalanuvchisi + uning avvalgi javobi. POST: initData URL/loglarda qolmasin. */
  @Post('tg-session')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  tgSession(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(telegramSessionSchema)) body: TelegramSessionInput,
  ): Promise<TelegramGuestSession> {
    return this.rsvp.telegramSession(this.slug(slug), body.initData);
  }

  /** Javob bergan mehmon yana tilak qo'shadi (muallif: Telegram yoki guestToken). */
  @Post('wishes')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  addWish(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(wishAddSchema)) body: WishAddParsed,
  ): Promise<OwnWishView> {
    return this.rsvp.addWish(this.slug(slug), body);
  }

  @Get('wishes')
  @Header('Cache-Control', 'public, max-age=30')
  wishes(@Param('slug') slug: string): Promise<PublicWish[]> {
    return this.rsvp.wishes(this.slug(slug));
  }

  private slug(value: string): string {
    if (!isValidSlug(value)) throw ApiError.notFound();
    return value;
  }
}
