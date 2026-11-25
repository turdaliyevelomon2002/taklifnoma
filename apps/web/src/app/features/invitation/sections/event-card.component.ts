import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { EventItem } from '@taklifnoma/shared';
import { LangService } from '../../../core/i18n/lang.service';
import { localize, LocalizePipe } from '../../../core/i18n/localize.pipe';
import { EventDatePipe } from '../../../shared/date/event-date.pipe';
import { googleCalendarUrl } from '../utils/calendar';
import { yandexDirectionsUrl, yandexPlaceUrl } from '../utils/maps';

/** Bitta tadbir: nomi, sana, vaqt, to'yxona va amallar (yo'nalish, xarita, kalendar, qo'ng'iroq). */
@Component({
  selector: 'tk-event-card',
  imports: [TranslocoPipe, LocalizePipe, EventDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = event();
    @let l = lang();
    @let tz = timezone();
    <article class="event" [class.event--primary]="e.isPrimary">
      <header class="event__head">
        @if (e.isPrimary) {
          <span class="event__badge">{{ 'invitation.event.primary' | transloco }}</span>
        }
        <h3 class="event__title">{{ e.title | loc: l }}</h3>
      </header>

      <div class="event__when">
        <div class="event__day">
          <span class="event__day-num">{{ e.startsAt | eventDate: 'day' : tz : l }}</span>
          <span class="event__day-month">{{ e.startsAt | eventDate: 'month' : tz : l }}</span>
        </div>
        <div class="event__when-text">
          <span class="event__weekday">{{ e.startsAt | eventDate: 'weekday' : tz : l }}</span>
          <span class="event__time">
            {{ e.startsAt | eventDate: 'time' : tz : l }}
            @if (e.endsAt) {
              <span class="event__time-sep">—</span>
              {{ e.endsAt | eventDate: 'time' : tz : l }}
            }
          </span>
        </div>
      </div>

      <div class="event__place">
        <svg class="event__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <div>
          <p class="event__venue">{{ e.venue.name | loc: l }}</p>
          <p class="event__address">{{ e.venue.address | loc: l }}</p>
        </div>
      </div>

      <div class="event__actions">
        <a class="tk-btn event__main-action" [href]="directionsUrl()" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
          {{ 'invitation.event.directions' | transloco }}
        </a>
        <div class="event__icons">
          <a class="icon-btn" [href]="placeUrl()" target="_blank" rel="noopener"
            [attr.aria-label]="'invitation.event.openMap' | transloco"
            [attr.title]="'invitation.event.openMap' | transloco">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" />
            </svg>
          </a>
          <a class="icon-btn" [href]="calendarUrl()" target="_blank" rel="noopener"
            [attr.aria-label]="'invitation.event.addToCalendar' | transloco"
            [attr.title]="'invitation.event.addToCalendar' | transloco">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" />
            </svg>
          </a>
          @if (e.venue.phone) {
            <a class="icon-btn" [href]="'tel:' + e.venue.phone"
              [attr.aria-label]="'invitation.event.call' | transloco"
              [attr.title]="'invitation.event.call' | transloco">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .event {
      position: relative;
      display: grid;
      gap: 1.1rem;
      padding: 1.5rem 1.25rem 1.25rem;
      text-align: left;
      border: 1px solid var(--tk-border);
      border-radius: calc(var(--tk-radius) * 1.3);
      background: var(--tk-surface);
      box-shadow: 0 14px 34px -22px color-mix(in srgb, var(--tk-primary) 55%, transparent);
      overflow: hidden;
    }
    .event--primary {
      border-color: color-mix(in srgb, var(--tk-accent) 70%, transparent);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--tk-accent) 14%, transparent),
        0 18px 40px -20px color-mix(in srgb, var(--tk-primary) 60%, transparent);
    }
    /* Yuqoridagi nozik rangli chiziq */
    .event::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--tk-accent), transparent);
      opacity: 0.6;
    }
    .event__head { display: grid; gap: 0.45rem; justify-items: start; }
    .event__badge {
      padding: 0.2rem 0.7rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--tk-accent) 18%, transparent);
      color: var(--tk-primary);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .event__title {
      margin: 0;
      font-family: var(--tk-font-heading);
      font-size: 1.55rem;
      font-weight: 600;
      line-height: 1.15;
      color: var(--tk-primary);
    }
    .event__when { display: flex; align-items: center; gap: 1rem; }
    .event__day {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 4.4rem;
      height: 4.4rem;
      border-radius: var(--tk-radius);
      background: var(--tk-primary);
      color: var(--tk-primary-contrast);
      line-height: 1;
      box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--tk-primary) 80%, transparent);
    }
    .event__day-num { font-family: var(--tk-font-heading); font-size: 1.8rem; font-weight: 600; }
    .event__day-month {
      margin-top: 0.2rem;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.88;
    }
    .event__when-text { display: grid; gap: 0.15rem; }
    .event__weekday {
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--tk-muted);
    }
    .event__time {
      font-family: var(--tk-font-heading);
      font-size: 1.45rem;
      font-weight: 600;
      color: var(--tk-text);
      font-variant-numeric: tabular-nums;
    }
    .event__time-sep { margin-inline: 0.2rem; color: var(--tk-muted); font-weight: 400; }
    .event__place {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--tk-radius);
      background: color-mix(in srgb, var(--tk-accent) 9%, transparent);
    }
    .event__icon { flex: none; margin-top: 0.15rem; color: var(--tk-primary); }
    .event__venue { margin: 0; font-weight: 700; line-height: 1.3; }
    .event__address { margin: 0.2rem 0 0; color: var(--tk-muted); font-size: 0.92rem; line-height: 1.4; }
    .event__actions { display: flex; align-items: center; gap: 0.5rem; }
    .event__main-action { flex: 1; min-width: 0; }
    .event__icons { display: flex; gap: 0.4rem; }
    .icon-btn {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid var(--tk-border);
      border-radius: 50%;
      background: var(--tk-surface);
      color: var(--tk-primary);
      transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
    }
    .icon-btn:hover {
      border-color: var(--tk-primary);
      background: color-mix(in srgb, var(--tk-primary) 8%, var(--tk-surface));
      transform: translateY(-1px);
    }
  `,
})
export class EventCardComponent {
  readonly event = input.required<EventItem>();
  readonly timezone = input.required<string>();

  protected readonly lang = inject(LangService).lang;
  protected readonly directionsUrl = computed(() => yandexDirectionsUrl(this.event().venue));
  protected readonly placeUrl = computed(() => yandexPlaceUrl(this.event().venue));
  protected readonly calendarUrl = computed(() => {
    const e = this.event();
    const l = this.lang();
    return googleCalendarUrl(e, localize(e.title, l), localize(e.venue.name, l), localize(e.venue.address, l));
  });
}
