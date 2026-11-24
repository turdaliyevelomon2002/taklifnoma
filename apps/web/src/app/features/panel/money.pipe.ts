import { inject, Pipe, PipeTransform } from '@angular/core';
import type { Locale } from '@taklifnoma/shared/enums';
import { LangService } from '../../core/i18n/lang.service';

/** 1500000 -> "1 500 000 so'm" (valyuta nomi i18n faylida). */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly i18n = inject(LangService);

  transform(value: number | null | undefined, _lang: Locale): string {
    if (value === null || value === undefined) return '—';
    const amount = Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return this.i18n.translate('panel.money', { amount });
  }
}
