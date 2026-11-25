import { inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import type { ResolveFn } from '@angular/router';
import type { Locale } from '@taklifnoma/shared/enums';
import { isLocale, LangService } from '../../core/i18n/lang.service';
import { SeoService } from '../../core/seo/seo.service';

/** Bosh sahifa shriftlari: sarlavha (serif), matn (sans) va kalligrafik ismlar. */
export const HOME_FONTS =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&display=swap';

/**
 * Tilni (?lang=ru) render'dan oldin yuklaydi: SSR HTML darhol to'g'ri tilda chiqadi.
 * Sarlavha, description va shriftlar ham shu yerda <head> ga yoziladi.
 */
export const homeResolver: ResolveFn<Locale> = async (route) => {
  const i18n = inject(LangService);
  const seo = inject(SeoService);
  const title = inject(Title);
  const meta = inject(Meta);

  const requested = route.queryParamMap.get('lang');
  const lang: Locale = isLocale(requested) ? requested : 'uz';
  await i18n.use(lang);

  seo.ensurePreconnect('https://fonts.googleapis.com');
  seo.ensurePreconnect('https://fonts.gstatic.com', true);
  seo.ensureStylesheet(HOME_FONTS);

  const pageTitle = i18n.translate('home.seo.title');
  const description = i18n.translate('home.seo.description');
  title.setTitle(pageTitle);
  meta.updateTag({ name: 'description', content: description });
  meta.updateTag({ property: 'og:title', content: pageTitle });
  meta.updateTag({ property: 'og:description', content: description });
  meta.updateTag({ property: 'og:type', content: 'website' });
  meta.updateTag({ name: 'theme-color', content: '#fbf8f3' });
  return lang;
};
