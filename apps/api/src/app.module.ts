import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppConfigModule } from './config/config.module';
import { CoupleModule } from './couple/couple.module';
import { HealthController } from './health/health.controller';
import { InvitationsModule } from './invitations/invitations.module';
import { OwnerModule } from './owner/owner.module';
import { PrismaModule } from './prisma/prisma.module';
import { RsvpModule } from './rsvp/rsvp.module';
import { StorageModule } from './storage/storage.module';
import { TelegramCoreModule } from './telegram/telegram-core.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    AppConfigModule,
    // Umumiy limit; sezgir endpointlarda @Throttle bilan qattiqroq qilinadi.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    TelegramCoreModule,
    AuthModule,
    InvitationsModule,
    CoupleModule,
    OwnerModule,
    RsvpModule,
    TelegramModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
