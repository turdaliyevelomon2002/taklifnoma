import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';

/**
 * SSR'da API'ning ichki manzili (masalan, http://api:3000). Brauzerda null:
 * u yerda so'rovlar nisbiy "/api/..." orqali (nginx yoki dev proksi) ketadi.
 */
export const SERVER_API_ORIGIN = new InjectionToken<string | null>('SERVER_API_ORIGIN', {
  providedIn: 'root',
  factory: () => null,
});

/**
 * Ilova doim nisbiy "/api/..." ishlatadi; SSR'da u ichki API manziliga aylantiriladi.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = inject(SERVER_API_ORIGIN);
  if (origin && req.url.startsWith('/api/')) {
    return next(req.clone({ url: `${origin}${req.url}` }));
  }
  return next(req);
};
