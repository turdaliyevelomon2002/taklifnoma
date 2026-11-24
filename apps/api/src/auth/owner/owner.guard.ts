import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../common/api-error';
import { OWNER_COOKIE } from '../cookies';
import { OwnerAuthService } from './owner-auth.service';

export interface OwnerRequest extends Request {
  ownerId?: string;
}

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly auth: OwnerAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<OwnerRequest>();
    const token: unknown = req.cookies?.[OWNER_COOKIE];
    if (typeof token !== 'string') throw ApiError.unauthorized();
    const payload = await this.auth.verify(token);
    if (!payload) throw ApiError.unauthorized();
    req.ownerId = payload.sub;
    return true;
  }
}

export const CurrentOwnerId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<OwnerRequest>().ownerId;
});
