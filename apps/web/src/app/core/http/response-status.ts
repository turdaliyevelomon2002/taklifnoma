import { inject, RESPONSE_INIT } from '@angular/core';

export type ResponseSetter = (status: number, headers?: Record<string, string>) => void;

/**
 * SSR javobining HTTP statusi va sarlavhalarini belgilaydigan funksiya qaytaradi.
 * Brauzerda hech narsa qilmaydi. Injection context'da (await'dan OLDIN) chaqiring.
 */
export function injectResponse(): ResponseSetter {
  const init = inject(RESPONSE_INIT, { optional: true });
  return (status, headers) => {
    if (!init) return;
    init.status = status;
    if (headers) {
      const current = new Headers(init.headers);
      for (const [k, v] of Object.entries(headers)) current.set(k, v);
      init.headers = current;
    }
  };
}
