import { computed, Directive, DOCUMENT, effect, inject, input, signal } from '@angular/core';
import type { PublicInvitation } from '@taklifnoma/shared';
import { LangService } from '../../../core/i18n/lang.service';
import { MusicPlayer } from '../music-player.service';
import { coupleNames, primaryEvent } from '../utils/config';

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
  protected readonly hasManyLocales = computed(() => this.config().locales.length > 1);

  /** Galereya/musiqa paket bo'yicha o'chiq bo'lsa API ularni umuman qaytarmaydi. */
  protected readonly gallery = computed(() => this.media().gallery);
  protected readonly musicUrl = computed(() => this.media().music?.url ?? null);

  /** Kirish "darvozasi" (intro) ochilganmi. */
  protected readonly opened = signal(false);

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

  /** Taklifnomani ochish: foydalanuvchi harakati bo'lgani uchun musiqa ham shu yerda boshlanadi. */
  protected openInvitation(): void {
    this.opened.set(true);
    const src = this.musicUrl();
    if (src) void this.music.play(src);
  }
}
