import { httpResource } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PublicWish } from '@taklifnoma/shared';
import { RsvpApi } from '../../../core/api/rsvp-api.service';
import { WishesStore } from '../wishes.store';

/**
 * Tilaklar devori. Shablonda @defer (on viewport) ichida ishlatiladi: SSR'da render qilinmaydi,
 * mehmon shu joyga yetganda yuklanadi. O'z tilagini yuborgandan keyin avtomatik yangilanadi.
 */
@Component({
  selector: 'tk-wishes',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length || ownPending().length) {
      @if (items().length) {
        <p class="wishes__count">{{ 'invitation.wishes.count' | transloco: { n: items().length } }}</p>
      }
      <div class="wishes__scroller">
        <ul class="wishes">
          @for (w of ownPending(); track w.id) {
            <li class="wish wish--own">
              <span class="wish__badge">
                <span aria-hidden="true">⏳</span> {{ 'invitation.wishes.pending' | transloco }}
              </span>
              <p class="wish__text">{{ w.text }}</p>
              <div class="wish__author">
                <span class="wish__avatar" aria-hidden="true">{{ initials(w.name) }}</span>
                <span class="wish__name">{{ w.name }}</span>
              </div>
              <p class="wish__hint">{{ 'invitation.wishes.pendingHint' | transloco }}</p>
            </li>
          }
          @for (w of items(); track w.id; let i = $index) {
            <li class="wish" [style.--i]="i % 6">
              <svg class="wish__quote" viewBox="0 0 32 24" width="28" height="21" aria-hidden="true">
                <path fill="currentColor" d="M0 24V14C0 6 4.5 1.3 12 0l1.5 3C9 4.5 7 7.4 7 11h6v13H0zm19 0V14c0-8 4.5-12.7 12-14l1 3c-4.5 1.5-6.5 4.4-6.5 8H32v13H19z" />
              </svg>
              <p class="wish__text">{{ w.wish }}</p>
              <div class="wish__author">
                <span class="wish__avatar" aria-hidden="true">{{ initials(w.name) }}</span>
                <span class="wish__name">{{ w.name }}</span>
              </div>
            </li>
          }
        </ul>
      </div>
    } @else if (!wishes.isLoading()) {
      <div class="wishes__empty">
        <span class="wishes__empty-icon" aria-hidden="true">♡</span>
        <p>{{ 'invitation.wishes.empty' | transloco }}</p>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .wishes__count {
      margin: -0.5rem 0 1rem;
      font-size: 0.85rem;
      color: var(--tk-muted);
    }
    /* Pastki qismi asta xiralashadi: ichida yana tilaklar borligi sezilsin */
    .wishes__scroller {
      max-height: 30rem;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.25rem 0.25rem 2rem;
      mask-image: linear-gradient(180deg, #000 85%, transparent);
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--tk-accent) 50%, transparent) transparent;
    }
    .wishes {
      columns: 1;
      column-gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
      text-align: left;
    }
    @media (min-width: 520px) { .wishes { columns: 2; } }
    .wish {
      position: relative;
      break-inside: avoid;
      margin-bottom: 0.75rem;
      padding: 1.1rem 1.1rem 1rem;
      border: 1px solid var(--tk-border);
      border-radius: calc(var(--tk-radius) * 1.2);
      background: var(--tk-surface);
      box-shadow: 0 10px 24px -20px color-mix(in srgb, var(--tk-primary) 60%, transparent);
    }
    .wish__quote { color: var(--tk-accent); opacity: 0.45; }
    .wish__text {
      margin: 0.35rem 0 0.9rem;
      white-space: pre-line;
      overflow-wrap: anywhere;
      line-height: 1.55;
    }
    .wish__author { display: flex; align-items: center; gap: 0.6rem; }
    .wish__avatar {
      display: grid;
      place-items: center;
      flex: none;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: 50%;
      /* Har bir kartaga biroz boshqa ton */
      background: color-mix(in srgb, var(--tk-primary) calc(55% + var(--i, 0) * 7%), var(--tk-accent));
      color: var(--tk-primary-contrast);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .wish__name { font-weight: 700; font-size: 0.92rem; color: var(--tk-primary); }
    .wish--own {
      border-style: dashed;
      border-color: color-mix(in srgb, var(--tk-accent) 70%, transparent);
      background: color-mix(in srgb, var(--tk-accent) 6%, var(--tk-surface));
    }
    .wish__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--tk-accent) 18%, transparent);
      color: var(--tk-primary);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .wish__hint { margin: 0.75rem 0 0; font-size: 0.78rem; color: var(--tk-muted); line-height: 1.4; }
    .wishes__empty {
      display: grid;
      justify-items: center;
      gap: 0.25rem;
      padding: 1.5rem;
      border: 1px dashed var(--tk-border);
      border-radius: var(--tk-radius);
      color: var(--tk-muted);
      p { margin: 0; font-style: italic; }
    }
    .wishes__empty-icon { font-size: 1.8rem; color: var(--tk-accent); }
  `,
})
export class WishesComponent {
  readonly slug = input.required<string>();

  private readonly api = inject(RsvpApi);
  private readonly store = inject(WishesStore);

  protected readonly wishes = httpResource<PublicWish[]>(() =>
    this.api.wishesUrl(this.slug(), this.store.version()),
  );
  protected readonly items = computed(() => (this.wishes.hasValue() ? this.wishes.value() : []));
  /** Mehmonning o'z tilaklari: hali devorda yo'qlari (tasdiqlanmagan) tepada alohida, yangisi avval. */
  protected readonly ownPending = computed(() => {
    const onWall = new Set(this.items().map((w) => w.id));
    return this.store
      .own()
      .filter((w) => !onWall.has(w.id))
      .reverse();
  });

  constructor() {
    afterNextRender(() => this.store.load(this.slug()));
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }
}
