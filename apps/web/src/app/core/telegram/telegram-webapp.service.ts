import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/** Telegram.WebApp ning bizga kerakli qismi (telegram-web-app.js yuklangandan keyin). */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
}

const STORAGE_KEY = 'tk-tg-init';
const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

/**
 * Sahifa Telegram Mini App ichida ochilganini aniqlaydi.
 * Telegram ishga tushirishda initData'ni URL fragmentida beradi: #tgWebAppData=...&tgWebAppVersion=...
 * Router navigatsiyasida fragment yo'qoladi, shuning uchun u ilova boshida sessionStorage'ga olinadi
 * (Mini App yopilguncha amal qiladi). Imzo serverda bot tokeni bilan tekshiriladi: bu yerda faqat tashiladi.
 */
@Injectable({ providedIn: 'root' })
export class TelegramWebAppService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);

  /** Xom initData (Telegram'dan tashqarida null). */
  readonly initData = signal<string | null>(null);
  readonly inTelegram = computed(() => this.initData() !== null);
  /** t.me/<bot>/<ilova>?startapp=<slug> dagi slug. */
  readonly startParam = computed(() => {
    const raw = this.initData();
    return raw ? new URLSearchParams(raw).get('start_param') : null;
  });

  /** provideAppInitializer'dan chaqiriladi (birinchi navigatsiyadan oldin). */
  capture(): void {
    if (!this.browser) return;
    const fromHash = readHashParam(this.document.location.hash, 'tgWebAppData');
    let raw = fromHash;
    try {
      if (fromHash) sessionStorage.setItem(STORAGE_KEY, fromHash);
      else raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* sessionStorage yo'q: faqat shu sahifada amal qiladi */
    }
    if (!raw) return;
    this.initData.set(raw);
    this.loadSdk();
  }

  /** Rasmiy SDK: Telegram'ga sahifa tayyorligini bildirish va to'liq balandlikka yoyish. */
  private loadSdk(): void {
    const script = this.document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      const app = (globalThis as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      app?.ready();
      app?.expand();
    };
    this.document.head.appendChild(script);
  }
}

function readHashParam(hash: string, name: string): string | null {
  if (!hash || hash.length < 2) return null;
  try {
    return new URLSearchParams(hash.slice(1)).get(name);
  } catch {
    return null;
  }
}
