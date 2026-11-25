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
      border-radius: calc(var(--tk-radius) * 1.3);
      background:
        radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--tk-accent) 18%, transparent), transparent 55%),
        repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb, var(--tk-border) 70%, transparent) 23px 24px),
        repeating-linear-gradient(90deg, transparent 0 23px, color-mix(in srgb, var(--tk-border) 70%, transparent) 23px 24px),
        var(--tk-surface);
      box-shadow: 0 18px 40px -26px color-mix(in srgb, var(--tk-primary) 70%, transparent);
    }
    .map__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .map__placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--tk-primary);
    }
    .map__placeholder svg { animation: bob 1.8s ease-in-out infinite; filter: drop-shadow(0 6px 6px rgb(0 0 0 / 0.2)); }
    @keyframes bob { 50% { transform: translateY(-6px); } }
    @media (prefers-reduced-motion: reduce) { .map__placeholder svg { animation: none; } }
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
