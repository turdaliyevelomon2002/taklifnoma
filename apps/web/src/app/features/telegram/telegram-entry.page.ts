import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TelegramWebAppService } from '../../core/telegram/telegram-webapp.service';

/**
 * Mini App kirish nuqtasi (BotFather'da Web App URL: https://domen.uz/tg).
 * t.me/<bot>/<ilova>?startapp=<slug> -> shu sahifa -> /<slug>.
 */
@Component({
  selector: 'tk-telegram-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class TelegramEntryPage implements OnInit {
  private readonly tg = inject(TelegramWebAppService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const slug = this.tg.startParam();
    // To'liq tekshiruv serverda (noto'g'ri slug -> 404); bu yerda faqat xavfsiz belgilar.
    void this.router.navigateByUrl(slug && /^[a-z0-9-]{3,64}$/.test(slug) ? `/${slug}` : '/', { replaceUrl: true });
  }
}
