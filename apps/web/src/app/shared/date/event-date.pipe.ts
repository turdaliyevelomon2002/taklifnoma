import { inject, Pipe, PipeTransform } from '@angular/core';
import type { Locale } from '@taklifnoma/shared/enums';
import { LangService } from '../../core/i18n/lang.service';
import { zonedParts } from './datetime';

export type EventDateFormat = 'full' | 'short' | 'time' | 'weekday' | 'day' | 'month';

/**
 * {{ event.startsAt | eventDate: 'full' : config.timezone : lang() }}
 * Oy va hafta kunlari nomlari i18n fayllaridan olinadi (brauzer Intl'iga bog'liq emas).
 */
@Pipe({ name: 'eventDate' })
export class EventDatePipe implements PipeTransform {
  private readonly i18n = inject(LangService);

  transform(iso: string, format: EventDateFormat, timeZone: string, _lang: Locale): string {
    const p = zonedParts(iso, timeZone);
    switch (format) {
      case 'time':
        return `${p.hour}:${p.minute}`;
      case 'day':
        return String(p.day);
      case 'month':
        return this.i18n.translate(`date.month.${p.month}`);
      case 'weekday':
        return this.i18n.translate(`date.weekday.${p.weekday}`);
      case 'short':
        return this.i18n.translate('date.short', {
          day: String(p.day).padStart(2, '0'),
          monthNum: String(p.month).padStart(2, '0'),
          year: p.year,
        });
      case 'full':
        return this.i18n.translate('date.full', {
          day: p.day,
          month: this.i18n.translate(`date.month.${p.month}`),
          year: p.year,
        });
    }
  }
}
