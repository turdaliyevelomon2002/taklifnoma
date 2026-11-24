import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  couplePinLoginSchema,
  coupleTokenLoginSchema,
  type CouplePinLoginInput,
  type CoupleTokenLoginInput,
} from '@taklifnoma/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AppConfig } from '../../config/app-config.service';
import {
  clearSessionCookie,
  COUPLE_COOKIE,
  COUPLE_SESSION_TTL_SEC,
  setSessionCookie,
} from '../cookies';
import { CoupleAuthService } from './couple-auth.service';

@Controller('couple/auth')
export class CoupleAuthController {
  constructor(
    private readonly auth: CoupleAuthService,
    private readonly config: AppConfig,
  ) {}

  /** Maxfiy havola: /{slug}/admin#k=<token> -> frontend shu endpointga yuboradi. */
  @Post('token')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginWithToken(
    @Body(new ZodValidationPipe(coupleTokenLoginSchema)) body: CoupleTokenLoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.auth.loginWithToken(body);
    this.setCookie(res, token);
  }

  /** PIN: IP bo'yicha throttling + taklifnoma bo'yicha 5 xato urinishdan keyin 15 daqiqa blok. */
  @Post('pin')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginWithPin(
    @Body(new ZodValidationPipe(couplePinLoginSchema)) body: CouplePinLoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.auth.loginWithPin(body);
    this.setCookie(res, token);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, COUPLE_COOKIE, this.secure);
  }

  private setCookie(res: Response, token: string): void {
    setSessionCookie(res, COUPLE_COOKIE, token, COUPLE_SESSION_TTL_SEC, this.secure);
  }

  private get secure(): boolean {
    return this.config.get('COOKIE_SECURE') ?? false;
  }
}
