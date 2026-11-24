import { EnvironmentProviders, Injectable, isDevMode } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { from, Observable } from 'rxjs';

/**
 * Tarjimalar HTTP orqali emas, dinamik import bilan yuklanadi: SSR'da ham, brauzerda ham
 * bir xil ishlaydi va har bir til alohida kichik chunk bo'lib tushadi.
 */
const LOADERS: Record<Locale, () => Promise<{ default: Translation }>> = {
  uz: () => import('../../../i18n/uz.json'),
  ru: () => import('../../../i18n/ru.json'),
};

@Injectable({ providedIn: 'root' })
class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const loader = LOADERS[lang as Locale] ?? LOADERS[DEFAULT_LOCALE];
    return from(loader().then((m) => m.default));
  }
}

export function provideI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LOCALES],
      defaultLang: DEFAULT_LOCALE,
      fallbackLang: DEFAULT_LOCALE,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
    },
    loader: BundledTranslationLoader,
  }) as EnvironmentProviders[];
}
