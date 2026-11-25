import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { MediaView } from '@taklifnoma/shared';

/**
 * Foto galereya: kichik webp variantlar lazy yuklanadi (srcset), bosilganda katta
 * variant to'liq ekranda ochiladi. Swipe, klaviatura (←/→/Esc) qo'llab-quvvatlanadi.
 */
@Component({
  selector: 'tk-gallery',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <ul class="grid">
      @for (item of items(); track item.id; let i = $index) {
        <li class="grid__item" [class.grid__item--wide]="i % 5 === 0" [class.grid__item--tall]="i % 5 === 3">
          <button
            type="button"
            class="grid__button"
            (click)="open(i)"
            [attr.aria-label]="'invitation.gallery.open' | transloco: { n: i + 1 }"
          >
            <img
              [src]="item.variants?.sm ?? item.url"
              [attr.srcset]="srcset(item)"
              sizes="(min-width: 600px) 280px, 50vw"
              [width]="item.width ?? 800"
              [height]="item.height ?? 600"
              loading="lazy"
              decoding="async"
              alt=""
            />
            <span class="grid__zoom" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            </span>
          </button>
        </li>
      }
    </ul>

    <!-- Native <dialog> top layer'da ochiladi: ota elementlardagi transform/animatsiya unga ta'sir qilmaydi,
         Esc va fokusni ushlab turish brauzerning o'zida. -->
    <dialog
      #dialog
      class="lightbox"
      (close)="index.set(null)"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
    >
      @if (current(); as item) {
        <img class="lightbox__img" [src]="item.variants?.lg ?? item.url" alt="" />
        <p class="lightbox__counter">
          {{ 'invitation.gallery.counter' | transloco: { current: index()! + 1, total: items().length } }}
        </p>
        <button type="button" class="lightbox__btn lightbox__close" (click)="close()"
          [attr.aria-label]="'invitation.gallery.close' | transloco">✕</button>
        @if (items().length > 1) {
          <button type="button" class="lightbox__btn lightbox__prev" (click)="step(-1)"
            [attr.aria-label]="'invitation.gallery.prev' | transloco">‹</button>
          <button type="button" class="lightbox__btn lightbox__next" (click)="step(1)"
            [attr.aria-label]="'invitation.gallery.next' | transloco">›</button>
        }
      }
    </dialog>
  `,
  styles: `
    :host { display: block; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-flow: dense;
      gap: 0.6rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .grid__item--wide { grid-column: span 2; }
    .grid__item--tall { grid-row: span 2; }
    .grid__button {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      border-radius: calc(var(--tk-radius) * 1.15);
      box-shadow: 0 12px 26px -18px rgb(0 0 0 / 0.5);
      overflow: hidden;
      background: var(--tk-surface);
      cursor: zoom-in;
    }
    .grid__button img {
      display: block;
      width: 100%;
      height: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1), filter 0.4s ease;
    }
    .grid__item--wide img { aspect-ratio: 16 / 10; }
    /* Baland katak: rasm qatorlar balandligini belgilamaydi, faqat to'ldiradi */
    .grid__item--tall img { position: absolute; inset: 0; aspect-ratio: auto; }
    .grid__button::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent 55%, rgb(0 0 0 / 0.35));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .grid__zoom {
      position: absolute;
      right: 0.6rem;
      bottom: 0.6rem;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.85);
      color: #222;
      opacity: 0;
      transform: translateY(0.4rem);
      transition: opacity 0.3s ease, transform 0.3s ease;
      backdrop-filter: blur(4px);
    }
    .grid__button:hover img { transform: scale(1.06); }
    .grid__button:hover::after, .grid__button:focus-visible::after { opacity: 1; }
    .grid__button:hover .grid__zoom, .grid__button:focus-visible .grid__zoom { opacity: 1; transform: none; }

    .lightbox {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      touch-action: pan-y;
      overscroll-behavior: contain;
    }
    .lightbox[open] {
      display: grid;
      place-items: center;
      animation: fade 0.2s ease;
    }
    .lightbox::backdrop { background: rgb(10 8 6 / 0.9); backdrop-filter: blur(14px); }
    .lightbox__img {
      max-width: min(100vw, 64rem);
      max-height: 82vh;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 30px 80px rgb(0 0 0 / 0.6);
      user-select: none;
      animation: zoom-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes zoom-in { from { opacity: 0; transform: scale(0.94); } }
    .lightbox__counter {
      position: absolute;
      bottom: 1.25rem;
      left: 0;
      right: 0;
      margin: 0;
      text-align: center;
      color: #fff;
      font-size: 0.9rem;
      opacity: 0.8;
    }
    .lightbox__btn {
      position: absolute;
      width: 3rem;
      height: 3rem;
      border: 0;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.12);
      color: #fff;
      backdrop-filter: blur(8px);
      transition: background 0.2s ease;
      font-size: 1.6rem;
      line-height: 1;
      cursor: pointer;
    }
    .lightbox__btn:hover { background: rgb(255 255 255 / 0.24); }
    .lightbox__close { top: 1rem; right: 1rem; font-size: 1.1rem; }
    .lightbox__prev { left: 0.75rem; top: 50%; transform: translateY(-50%); }
    .lightbox__next { right: 0.75rem; top: 50%; transform: translateY(-50%); }
    @keyframes fade { from { opacity: 0; } }
  `,
})
export class GalleryComponent {
  readonly items = input.required<MediaView[]>();

  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly index = signal<number | null>(null);
  protected readonly current = computed(() => {
    const i = this.index();
    return i === null ? null : (this.items()[i] ?? null);
  });
  private pointerStartX: number | null = null;

  constructor() {
    effect(() => {
      const open = this.index() !== null;
      const el = this.dialog().nativeElement;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
      // Lightbox ochiq paytda orqa fon aylanmasin.
      this.document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  protected srcset(item: MediaView): string | null {
    const v = item.variants;
    if (!v) return null;
    return [v.sm && `${v.sm} 480w`, v.md && `${v.md} 960w`, v.lg && `${v.lg} 1600w`]
      .filter(Boolean)
      .join(', ');
  }

  protected open(i: number): void {
    this.index.set(i);
  }

  protected close(): void {
    this.index.set(null);
  }

  protected step(delta: number): void {
    const i = this.index();
    const total = this.items().length;
    if (i === null || total === 0) return;
    this.index.set((i + delta + total) % total);
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.index() === null) return;
    if (event.key === 'ArrowRight') this.step(1);
    else if (event.key === 'ArrowLeft') this.step(-1);
  }

  protected onPointerDown(event: PointerEvent): void {
    this.pointerStartX = event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.pointerStartX === null) return;
    const dx = event.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1);
    else if (event.target === event.currentTarget) this.close();
  }
}
