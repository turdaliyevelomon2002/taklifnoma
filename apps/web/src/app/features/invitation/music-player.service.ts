import { DOCUMENT, inject, Injectable, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Fon musiqasi. Brauzerlar ovozli autoplay'ni bloklaydi, shuning uchun musiqa faqat
 * foydalanuvchi harakati bilan (taklifnomani ochish yoki tugma) boshlanadi.
 * Sahifa darajasida provide qilinadi.
 */
@Injectable()
export class MusicPlayer implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private audio: HTMLAudioElement | null = null;

  readonly playing = signal(false);

  private readonly onVisibility = () => {
    if (this.document.hidden) this.pause();
  };

  async play(src: string): Promise<void> {
    if (!this.isBrowser) return;
    if (!this.audio) {
      this.audio = new Audio(src);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.addEventListener('pause', () => this.playing.set(false));
      this.audio.addEventListener('play', () => this.playing.set(true));
      // Telegram'dan boshqa ilovaga o'tilsa musiqa to'xtaydi.
      this.document.addEventListener('visibilitychange', this.onVisibility);
    }
    try {
      await this.audio.play();
    } catch {
      // Brauzer ruxsat bermadi (masalan, harakat aniqlanmadi): tugma orqali qayta urinish mumkin.
      this.playing.set(false);
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  toggle(src: string): void {
    if (this.playing()) this.pause();
    else void this.play(src);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
