import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { LangService } from '../../core/i18n/lang.service';
import { DEMO_SLUG, HOME_CONTACT, PRICING_ROWS } from './home.config';

type PackageKey = 'basic' | 'standard' | 'premium';

/** Ommaviy bosh sahifa (landing): xizmat, shablonlar, paketlar, savollar va aloqa. */
@Component({
  selector: 'tk-home-page',
  imports: [TranslocoPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  protected readonly i18n = inject(LangService);
  private readonly location = inject(Location);

  protected readonly locales = LOCALES;
  protected readonly demoUrl = `/${DEMO_SLUG}`;
  protected readonly year = new Date().getFullYear();

  protected readonly telegramUrl = HOME_CONTACT.telegram ? `https://t.me/${HOME_CONTACT.telegram}` : null;
  protected readonly phoneUrl = HOME_CONTACT.phone ? `tel:${HOME_CONTACT.phone}` : null;
  protected readonly phoneLabel = HOME_CONTACT.phone;
  /** Asosiy "Buyurtma berish" tugmasi: Telegram > telefon > demo. */
  protected readonly orderUrl = this.telegramUrl ?? this.phoneUrl;
  protected readonly hasContact = !!this.orderUrl;

  /** Demo havolasi joriy tilni saqlaydi. */
  protected readonly demoQuery = computed(() => (this.i18n.lang() === 'uz' ? {} : { lang: this.i18n.lang() }));

  protected readonly marquee = [1, 2, 3, 4, 5, 6, 7];
  protected readonly steps = [1, 2, 3];
  protected readonly features = ['rsvp', 'telegram', 'map', 'countdown', 'gallery', 'excel', 'lang'] as const;
  protected readonly templates = ['classic', 'minimal', 'national'] as const;
  protected readonly packages: readonly PackageKey[] = ['basic', 'standard', 'premium'];
  protected readonly pricingRows = PRICING_ROWS;
  protected readonly faq = [1, 2, 3, 4, 5, 6];
  /** Telefon maketidagi galereya katakchalari. */
  protected readonly mockTiles = [1, 2, 3];

  protected async setLang(lang: Locale): Promise<void> {
    if (lang === this.i18n.lang()) return;
    await this.i18n.use(lang);
    this.location.replaceState('/', lang === 'uz' ? '' : `lang=${lang}`);
  }
}
