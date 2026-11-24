import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Venue } from '@taklifnoma/shared';
import { LangService } from '../../../core/i18n/lang.service';
import { localize } from '../../../core/i18n/localize.pipe';
import { yandexWidgetUrl } from '../utils/maps';

/**
 * Yandex xarita vidjeti. Iframe og'ir (~1 MB), shuning uchun @defer bilan faqat foydalanuvchi
 * xaritaga yaqinlashganda yuklanadi; SSR'da va undan oldin yengil placeholder ko'rinadi.
 */
@Component({
  selector: 'tk-venue-map',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map">
      @defer (on viewport) {
        <iframe
          class="map__frame"
          [src]="widgetUrl()"
          [title]="'invitation.event.mapTitle' | transloco: { venue: venueName() }"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
        ></iframe>
      } @placeholder {
        <div class="map__placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .map {
      position: relative;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border: 1px solid var(--tk-border);
      border-radius: var(--tk-radius);
      background: var(--tk-surface);
    }
    .map__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .map__placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--tk-primary);
      opacity: 0.6;
    }
  `,
})
export class VenueMapComponent {
  readonly venue = input.required<Venue>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly lang = inject(LangService).lang;

  /** URL faqat tekshirilgan raqamli koordinatalar yoki raqamli org ID'dan yasaladi. */
  protected readonly widgetUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(yandexWidgetUrl(this.venue())),
  );
  protected readonly venueName = computed(() => localize(this.venue().name, this.lang()));
}
