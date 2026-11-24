import { Global, Module } from '@nestjs/common';
import { TelegramApi } from './telegram-api.service';
import { TelegramLinkService } from './telegram-link.service';

/** Boshqa modullar (presenter, RSVP) ishlatadigan yengil qism: API klient va deep link'lar. */
@Global()
@Module({
  providers: [TelegramApi, TelegramLinkService],
  exports: [TelegramApi, TelegramLinkService],
})
export class TelegramCoreModule {}
