import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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
    @if (items().length) {
      <ul class="wishes">
        @for (w of items(); track w.id) {
          <li class="wish">
            <p class="wish__text">{{ w.wish }}</p>
            <p class="wish__name">— {{ w.name }}</p>
          </li>
        }
      </ul>
    } @else if (!wishes.isLoading()) {
      <p class="wishes__empty">{{ 'invitation.wishes.empty' | transloco }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .wishes {
      display: grid;
      gap: 0.75rem;
      max-height: 28rem;
      margin: 0;
      padding: 0 0.25rem 0 0;
      overflow-y: auto;
      list-style: none;
      text-align: left;
      overscroll-behavior: contain;
    }
    .wish {
      padding: 1rem 1.1rem;
      border: 1px solid var(--tk-border);
      border-radius: var(--tk-radius);
      background: var(--tk-surface);
    }
    .wish__text { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
    .wish__name { margin: 0.5rem 0 0; font-style: italic; color: var(--tk-primary); text-align: right; }
    .wishes__empty { margin: 0; color: var(--tk-muted); font-style: italic; }
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
}
