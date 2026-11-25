import { Injectable, signal } from '@angular/core';

/** Mehmonning o'z tilagi (faqat shu brauzerda yoki Telegram sessiyasidan). */
export interface OwnWish {
  id: string;
  /** Muallif ismi (javobdagi ism). */
  name: string;
  text: string;
  /** Server qaytargan holat. Yashirilgan tilak ham mehmonga PENDING bo'lib ko'rinadi. */
  status: 'PENDING' | 'APPROVED';
  createdAt: string;
}

/**
 * RSVP formasi va tilaklar devori o'rtasidagi aloqa (sahifa darajasida).
 * Tasdiqlanmagan tilaklar boshqalarga ko'rinmaydi, lekin muallifning o'zi ularni
 * "tasdiqlanishi kutilmoqda" belgisi bilan ko'radi: aks holda u qayta-qayta yozardi.
 */
@Injectable()
export class WishesStore {
  /** Yangi tilak qo'shilganda oshadi: tilaklar devori qayta yuklanadi. */
  readonly version = signal(0);
  readonly own = signal<OwnWish[]>([]);
  /** Brauzerdagi mehmon yana tilak qo'shishi uchun server bergan kalit. */
  readonly guestToken = signal<string | null>(null);

  bump(): void {
    this.version.update((v) => v + 1);
  }

  /** Brauzerda chaqiriladi (SSR'da localStorage yo'q). */
  load(slug: string): void {
    this.own.set(parseOwn(read(wishKey(slug))));
    this.guestToken.set(read(tokenKey(slug)));
  }

  /** Telegram sessiyasidan: server bergan to'liq ro'yxat. */
  setOwn(slug: string, list: OwnWish[]): void {
    this.own.set(list);
    write(wishKey(slug), list.length ? JSON.stringify(list) : null);
  }

  addOwn(slug: string, wish: OwnWish): void {
    this.setOwn(slug, [...this.own().filter((w) => w.id !== wish.id), wish]);
  }

  setGuestToken(slug: string, token: string): void {
    this.guestToken.set(token);
    write(tokenKey(slug), token);
  }
}

const wishKey = (slug: string) => `tk-wish:${slug}`;
const tokenKey = (slug: string) => `tk-guest:${slug}`;

/** Eski format (bitta obyekt, matn "wish" maydonida) ham o'qiladi. */
function parseOwn(raw: string | null): OwnWish[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    const list = (Array.isArray(value) ? value : [value]) as Array<Partial<OwnWish> & { wish?: string }>;
    return list
      .map((w) => ({ ...w, text: w.text ?? w.wish ?? '' }) as OwnWish)
      .filter((w) => w.id && w.text);
  } catch {
    return [];
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Shaxsiy rejim: faqat shu sessiyada ko'rinadi */
  }
}
