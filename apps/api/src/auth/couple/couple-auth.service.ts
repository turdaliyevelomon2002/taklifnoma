import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CouplePinLoginInput, CoupleTokenLoginInput } from '@taklifnoma/shared';
import { ApiError } from '../../common/api-error';
import { safeEqualHex, sha256, verifySecret } from '../../common/crypto';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { COUPLE_SESSION_TTL_SEC } from '../cookies';

export interface CoupleJwtPayload {
  /** invitationId */
  sub: string;
  /** Invitation.accessVersion: kirish qayta generatsiya qilinsa eski sessiyalar bekor bo'ladi. */
  ver: number;
}

const AUDIENCE = 'couple';
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

@Injectable()
export class CoupleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async loginWithToken(input: CoupleTokenLoginInput): Promise<string> {
    const inv = await this.prisma.invitation.findUnique({
      where: { slug: input.slug },
      select: { id: true, adminTokenHash: true, accessVersion: true },
    });
    if (!inv || !safeEqualHex(inv.adminTokenHash, sha256(input.token))) {
      throw ApiError.unauthorized('INVALID_CREDENTIALS');
    }
    return this.issue(inv.id, inv.accessVersion);
  }

  async loginWithPin(input: CouplePinLoginInput): Promise<string> {
    const inv = await this.prisma.invitation.findUnique({
      where: { slug: input.slug },
      select: { id: true, adminPinHash: true, accessVersion: true, pinLockedUntil: true },
    });
    if (!inv || !inv.adminPinHash) throw ApiError.unauthorized('INVALID_CREDENTIALS');

    if (inv.pinLockedUntil && inv.pinLockedUntil > new Date()) {
      throw ApiError.forbidden('PIN_LOCKED', { lockedUntil: inv.pinLockedUntil.toISOString() });
    }

    if (!(await verifySecret(inv.adminPinHash, input.pin))) {
      await this.registerFailedPin(inv.id);
      throw ApiError.unauthorized('INVALID_CREDENTIALS');
    }

    await this.prisma.invitation.update({
      where: { id: inv.id },
      data: { pinFailedCount: 0, pinLockedUntil: null },
    });
    return this.issue(inv.id, inv.accessVersion);
  }

  async verify(token: string): Promise<CoupleJwtPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<CoupleJwtPayload>(token, {
        secret: this.config.get('COUPLE_JWT_SECRET'),
        audience: AUDIENCE,
      });
      const inv = await this.prisma.invitation.findUnique({
        where: { id: payload.sub },
        select: { accessVersion: true },
      });
      return inv && inv.accessVersion === payload.ver ? payload : null;
    } catch {
      return null;
    }
  }

  private async registerFailedPin(invitationId: string): Promise<void> {
    // Atomik oshirish: parallel so'rovlar hisoblagichni chetlab o'ta olmaydi.
    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { pinFailedCount: { increment: 1 } },
      select: { pinFailedCount: true },
    });
    if (updated.pinFailedCount >= PIN_MAX_ATTEMPTS) {
      await this.prisma.invitation.update({
        where: { id: invitationId },
        data: {
          pinFailedCount: 0,
          pinLockedUntil: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000),
        },
      });
    }
  }

  private issue(invitationId: string, ver: number): Promise<string> {
    return this.jwt.signAsync({ sub: invitationId, ver } satisfies CoupleJwtPayload, {
      secret: this.config.get('COUPLE_JWT_SECRET'),
      audience: AUDIENCE,
      expiresIn: COUPLE_SESSION_TTL_SEC,
    });
  }
}
