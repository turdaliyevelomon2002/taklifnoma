import { DOCUMENT, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { firstValueFrom, type Observable } from 'rxjs';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Faol til signal sifatida + tarjimani oldindan yuklash (SSR'da "miltillash" bo'lmasligi uchun). */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly lang = toSignal(this.transloco.langChanges$ as Observable<Locale>, {
    initialValue: this.transloco.getActiveLang() as Locale,
  });

  /** Tarjima yuklanib bo'lgach tilni almashtiradi. */
  async use(lang: Locale): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.document.documentElement.lang = lang;
  }

  translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  /** Ko'plik shakli kaliti: ru uchun one/few/many, uz uchun one/other. */
  pluralKey(base: string, count: number): string {
    const category = new Intl.PluralRules(this.lang() ?? DEFAULT_LOCALE).select(count);
    return `${base}.${category}`;
  }
}
