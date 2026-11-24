import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoupleAuthController } from './couple/couple-auth.controller';
import { CoupleAuthService } from './couple/couple-auth.service';
import { CoupleGuard } from './couple/couple.guard';
import { OwnerAuthController } from './owner/owner-auth.controller';
import { OwnerAuthService } from './owner/owner-auth.service';
import { OwnerGuard } from './owner/owner.guard';

/** Sirlar (secret) har bir chaqiruvda alohida beriladi: owner va couple sessiyalari ajratilgan. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [OwnerAuthController, CoupleAuthController],
  providers: [OwnerAuthService, OwnerGuard, CoupleAuthService, CoupleGuard],
  exports: [OwnerAuthService, OwnerGuard, CoupleAuthService, CoupleGuard],
})
export class AuthModule {}
