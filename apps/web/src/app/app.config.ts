import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { DEFAULT_LOCALE } from '@taklifnoma/shared/enums';
import { routes } from './app.routes';
import { apiUrlInterceptor } from './core/api/api-url.interceptor';
import { LangService } from './core/i18n/lang.service';
import { provideI18n } from './core/i18n/transloco.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // /:slug/admin sahifasi ota route'dagi :slug'ni input sifatida oladi.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    // Event replay: hydration tugaguncha bosilgan tugmalar (masalan, "Taklifnomani ochish") yo'qolmaydi.
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([apiUrlInterceptor])),
    provideI18n(),
    // Standart til render'dan oldin yuklanadi (SSR'da bo'sh matnlar chiqmasligi uchun).
    provideAppInitializer(() => inject(LangService).use(DEFAULT_LOCALE)),
  ],
};
