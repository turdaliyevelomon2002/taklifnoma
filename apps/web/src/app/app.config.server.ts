import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SERVER_API_ORIGIN } from './core/api/api-url.interceptor';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // SSR'da API'ga to'g'ridan-to'g'ri (Docker tarmog'i ichida) murojaat qilinadi.
    {
      provide: SERVER_API_ORIGIN,
      useFactory: () => (process.env['API_INTERNAL_ORIGIN'] ?? 'http://localhost:3000').replace(/\/+$/, ''),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
