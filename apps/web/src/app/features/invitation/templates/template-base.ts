import { computed, Directive, DOCUMENT, effect, inject, InjectionToken, input, signal } from '@angular/core';
import type { PublicInvitation } from '@taklifnoma/shared';
import { LangService } from '../../../core/i18n/lang.service';
import { MusicPlayer } from '../music-player.service';
import { zonedParts } from '../../../shared/date/datetime';
import { coupleNames, primaryEvent } from '../utils/config';

/** Panel muharriridagi jonli preview: kirish (intro) darhol ochiq turadi. */
export const SKIP_INTRO = new InjectionToken<boolean>('SKIP_INTRO');

/**
 * Barcha shablonlar uchun umumiy kontrakt va hisoblangan qiymatlar.
 * Shablon faqat joylashuv va dizaynni belgilaydi; ma'lumot mantiqi shu yerda.
 *
 *   export class MyTemplate extends InvitationTemplateBase { ... }
 */
@Directive()
export abstract class InvitationTemplateBase {
  readonly invitation = input.required<PublicInvitation>();

  protected readonly lang = inject(LangService).lang;
  protected readonly music = inject(MusicPlayer);

  protected readonly config = computed(() => this.invitation().config);
  protected readonly features = computed(() => this.invitation().features);
  protected readonly media = computed(() => this.invitation().media);
  protected readonly primaryEvent = computed(() => primaryEvent(this.config()));
  protected readonly names = computed(() => coupleNames(this.config(), this.lang()));
  /** Muhr/monogramma uchun bosh harflar: "A·M". */
  protected readonly initials = computed(() =>
    this.names()
      .map((n) => n.trim().charAt(0).toUpperCase())
      .join('·'),
  );
  /** Asosiy tadbir yili (taklifnoma vaqt zonasida). */
  protected readonly year = computed(() => zonedParts(this.primaryEvent().startsAt, this.config().timezone).year);
  protected readonly hasManyLocales = computed(() => this.config().locales.length > 1);

  /** Galereya/musiqa paket bo'yicha o'chiq bo'lsa API ularni umuman qaytarmaydi. */
  protected readonly gallery = computed(() => this.media().gallery);
  protected readonly musicUrl = computed(() => this.media().music?.url ?? null);

  /** Kirish "darvozasi" (intro) ochilganmi. */
  protected readonly opened = signal(inject(SKIP_INTRO, { optional: true }) ?? false);
  /** Ochilish animatsiyasi ketyapti (masalan, konvert ochilmoqda). */
  protected readonly opening = signal(false);

  /** Shablon ranglarini config.theme bilan almashtirish (CSS custom properties). */
  protected readonly themeStyle = computed(() => {
    const theme = this.config().theme;
    const style: Record<string, string> = {};
    if (theme?.primaryColor) style['--tk-primary'] = theme.primaryColor;
    if (theme?.accentColor) style['--tk-accent'] = theme.accentColor;
    return style;
  });

  constructor() {
    const body = inject(DOCUMENT).body;
    // Intro ochilguncha orqadagi sahifa aylanmasin (iOS'da fixed overlay ostida scroll bo'ladi).
    effect(() => {
      body.style.overflow = this.opened() ? '' : 'hidden';
    });
  }

  /**
   * Taklifnomani ochish. Musiqa darhol (foydalanuvchi harakati ichida) boshlanadi: aks holda iOS
   * uni bloklaydi. delayMs: shablonning ochilish animatsiyasi davomiyligi.
   */
  protected openInvitation(delayMs = 0): void {
    if (this.opening() || this.opened()) return;
    const src = this.musicUrl();
    if (src) void this.music.play(src);
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!delayMs || reduced) {
      this.opened.set(true);
      return;
    }
    this.opening.set(true);
    setTimeout(() => this.opened.set(true), delayMs);
  }
}
