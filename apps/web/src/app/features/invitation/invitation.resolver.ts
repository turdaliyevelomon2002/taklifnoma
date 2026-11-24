import { inject, Type } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ResolveFn } from '@angular/router';
import type { PublicInvitation } from '@taklifnoma/shared';
import type { Locale } from '@taklifnoma/shared/enums';
import { firstValueFrom } from 'rxjs';
import { PublicApi } from '../../core/api/public-api.service';
import { injectResponse } from '../../core/http/response-status';
import { isLocale, LangService } from '../../core/i18n/lang.service';
import { localize } from '../../core/i18n/localize.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { getTemplate } from './templates/registry';
import type { InvitationTemplateBase } from './templates/template-base';
import { coupleNames, primaryEvent } from './utils/config';
import { zonedParts } from '../../shared/date/datetime';

export type InvitationRouteData =
  | { status: 'ok'; invitation: PublicInvitation; component: Type<InvitationTemplateBase> }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * Sahifa render qilinishidan OLDIN hamma narsani tayyorlaydi: ma'lumot, til tarjimasi,
 * shablon chunk'i va SEO teglari. Shu tufayli SSR HTML to'liq bo'ladi va hydration miltillamaydi.
 */
export const invitationResolver: ResolveFn<InvitationRouteData> = async (route) => {
  // inject() faqat birinchi await'gacha ishlaydi.
  const api = inject(PublicApi);
  const i18n = inject(LangService);
  const seo = inject(SeoService);
  const meta = inject(Meta);
  const respond = injectResponse();

  const slug = route.paramMap.get('slug') ?? '';
  const result = await firstValueFrom(api.invitation(slug));

  if (result.status !== 'ok') {
    respond(result.status === 'not-found' ? 404 : 503, { 'Cache-Control': 'no-store' });
    seo.setRobots('noindex');
    return result;
  }

  const invitation = result.data;
  const requested = route.queryParamMap.get('lang');
  const lang: Locale =
    isLocale(requested) && invitation.config.locales.includes(requested)
      ? requested
      : invitation.config.defaultLocale;

  const template = getTemplate(invitation.templateKey);
  const [component] = await Promise.all([template.load(), i18n.use(lang)]);

  for (const href of template.fonts) seo.ensureStylesheet(href);
  meta.updateTag({ name: 'theme-color', content: template.themeColor });
  applySeo(seo, i18n, invitation, lang);

  // Owner o'zgartirgan ma'lumot tez ko'rinishi uchun qisqa kesh.
  respond(200, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });
  return { status: 'ok', invitation, component };
};

function applySeo(seo: SeoService, i18n: LangService, inv: PublicInvitation, lang: Locale): void {
  const cfg = inv.config;
  const [first, second] = coupleNames(cfg, lang);
  const event = primaryEvent(cfg);
  const p = zonedParts(event.startsAt, cfg.timezone);
  const date = i18n.translate('date.full', {
    day: p.day,
    month: i18n.translate(`date.month.${p.month}`),
    year: p.year,
  });

  const title =
    localize(cfg.seo?.title, lang) ||
    i18n.translate('seo.title', { names: `${first} & ${second}` });
  const description =
    localize(cfg.seo?.description, lang) ||
    i18n.translate('seo.description', { date, venue: localize(event.venue.name, lang) });

  seo.apply({
    title,
    description,
    url: inv.seo.canonicalUrl,
    image: inv.seo.ogImageUrl,
    locale: lang,
    siteName: i18n.translate('app.name'),
  });
  // Shaxsiy taklifnomalar qidiruv tizimlariga tushmaydi; Telegram preview bunga bog'liq emas.
  seo.setRobots('noindex, nofollow');
}
