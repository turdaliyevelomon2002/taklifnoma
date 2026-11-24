import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { EventItem } from '@taklifnoma/shared';
import { LangService } from '../../../core/i18n/lang.service';
import { LocalizePipe } from '../../../core/i18n/localize.pipe';
import { EventDatePipe } from '../../../shared/date/event-date.pipe';
import { yandexDirectionsUrl, yandexPlaceUrl } from '../utils/maps';

/** Bitta tadbir: nomi, sana, vaqt, to'yxona, "Yo'nalish" va xarita tugmalari. */
@Component({
  selector: 'tk-event-card',
  imports: [TranslocoPipe, LocalizePipe, EventDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = event();
    @let l = lang();
    <article class="event">
      <h3 class="event__title">{{ e.title | loc: l }}</h3>
      <p class="event__date">
        {{ e.startsAt | eventDate: 'weekday' : timezone() : l }},
        {{ e.startsAt | eventDate: 'full' : timezone() : l }}
      </p>
      <p class="event__time">
        <span class="event__time-value">{{ e.startsAt | eventDate: 'time' : timezone() : l }}</span>
        @if (e.endsAt) {
          <span class="event__time-sep">—</span>
          <span class="event__time-value">{{ e.endsAt | eventDate: 'time' : timezone() : l }}</span>
        }
      </p>
      <p class="event__venue">{{ e.venue.name | loc: l }}</p>
      <p class="event__address">{{ e.venue.address | loc: l }}</p>

      <div class="event__actions">
        <a class="tk-btn" [href]="directionsUrl()" target="_blank" rel="noopener">
          {{ 'invitation.event.directions' | transloco }}
        </a>
        <a class="tk-btn tk-btn--ghost" [href]="placeUrl()" target="_blank" rel="noopener">
          {{ 'invitation.event.openMap' | transloco }}
        </a>
        @if (e.venue.phone) {
          <a class="tk-btn tk-btn--ghost" [href]="'tel:' + e.venue.phone">
            {{ 'invitation.event.call' | transloco }}
          </a>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .event {
      padding: 1.5rem 1.25rem;
      text-align: center;
      border: 1px solid var(--tk-border);
      border-radius: var(--tk-radius);
      background: var(--tk-surface);
    }
    .event__title {
      margin: 0 0 0.5rem;
      font-family: var(--tk-font-heading);
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--tk-primary);
    }
    .event__date { margin: 0; color: var(--tk-text); }
    .event__time {
      margin: 0.25rem 0 1rem;
      font-family: var(--tk-font-heading);
      font-size: 1.75rem;
      color: var(--tk-text);
      font-variant-numeric: tabular-nums;
    }
    .event__time-sep { margin-inline: 0.4rem; color: var(--tk-muted); }
    .event__venue { margin: 0; font-weight: 600; }
    .event__address { margin: 0.25rem 0 1.25rem; color: var(--tk-muted); font-size: 0.95rem; }
    .event__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
    }
  `,
})
export class EventCardComponent {
  readonly event = input.required<EventItem>();
  readonly timezone = input.required<string>();

  protected readonly lang = inject(LangService).lang;
  protected readonly directionsUrl = computed(() => yandexDirectionsUrl(this.event().venue));
  protected readonly placeUrl = computed(() => yandexPlaceUrl(this.event().venue));
}
