import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { OwnerLoginInput, OwnerProfile } from '@taklifnoma/shared';
import { ApiError } from '../../common/api-error';
import { hashSecret, verifySecret } from '../../common/crypto';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OWNER_SESSION_TTL_SEC } from '../cookies';

export interface OwnerJwtPayload {
  sub: string;
}

const AUDIENCE = 'owner';

@Injectable()
export class OwnerAuthService implements OnModuleInit {
  /** Mavjud bo'lmagan email uchun ham argon2 ishlaydi: javob vaqtidan email borligini bilib bo'lmaydi. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashSecret('dummy-password-for-timing');
  }

  async login(input: OwnerLoginInput): Promise<{ token: string; profile: OwnerProfile }> {
    const owner = await this.prisma.owner.findUnique({ where: { email: input.email } });
    const ok = await verifySecret(owner?.passwordHash ?? this.dummyHash, input.password);
    if (!owner || !ok) throw ApiError.unauthorized('INVALID_CREDENTIALS');

    const token = await this.jwt.signAsync({ sub: owner.id } satisfies OwnerJwtPayload, {
      secret: this.config.get('OWNER_JWT_SECRET'),
      audience: AUDIENCE,
      expiresIn: OWNER_SESSION_TTL_SEC,
    });
    return { token, profile: this.toProfile(owner) };
  }

  async verify(token: string): Promise<OwnerJwtPayload | null> {
    try {
      return await this.jwt.verifyAsync<OwnerJwtPayload>(token, {
        secret: this.config.get('OWNER_JWT_SECRET'),
        audience: AUDIENCE,
      });
    } catch {
      return null;
    }
  }

  async profile(ownerId: string): Promise<OwnerProfile> {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw ApiError.unauthorized();
    return this.toProfile(owner);
  }

  private toProfile(owner: { id: string; email: string; telegramChatId: string | null }): OwnerProfile {
    return { id: owner.id, email: owner.email, telegramLinked: !!owner.telegramChatId };
  }
}
