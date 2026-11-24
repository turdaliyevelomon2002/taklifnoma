import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../common/api-error';
import { COUPLE_COOKIE } from '../cookies';
import { CoupleAuthService } from './couple-auth.service';

export interface CoupleRequest extends Request {
  invitationId?: string;
}

@Injectable()
export class CoupleGuard implements CanActivate {
  constructor(private readonly auth: CoupleAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<CoupleRequest>();
    const token: unknown = req.cookies?.[COUPLE_COOKIE];
    if (typeof token !== 'string') throw ApiError.unauthorized();
    const payload = await this.auth.verify(token);
    if (!payload) throw ApiError.unauthorized();
    req.invitationId = payload.sub;
    return true;
  }
}

export const CoupleInvitationId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<CoupleRequest>().invitationId;
});
