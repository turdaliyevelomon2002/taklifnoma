import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ownerLoginSchema, type OwnerLoginInput, type OwnerProfile } from '@taklifnoma/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AppConfig } from '../../config/app-config.service';
import {
  clearSessionCookie,
  OWNER_COOKIE,
  OWNER_SESSION_TTL_SEC,
  setSessionCookie,
} from '../cookies';
import { OwnerAuthService } from './owner-auth.service';
import { CurrentOwnerId, OwnerGuard } from './owner.guard';

@Controller('owner/auth')
export class OwnerAuthController {
  constructor(
    private readonly auth: OwnerAuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(ownerLoginSchema)) body: OwnerLoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OwnerProfile> {
    const { token, profile } = await this.auth.login(body);
    setSessionCookie(res, OWNER_COOKIE, token, OWNER_SESSION_TTL_SEC, this.secure);
    return profile;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, OWNER_COOKIE, this.secure);
  }

  @Get('me')
  @UseGuards(OwnerGuard)
  me(@CurrentOwnerId() ownerId: string): Promise<OwnerProfile> {
    return this.auth.profile(ownerId);
  }

  private get secure(): boolean {
    return this.config.get('COOKIE_SECURE') ?? false;
  }
}
