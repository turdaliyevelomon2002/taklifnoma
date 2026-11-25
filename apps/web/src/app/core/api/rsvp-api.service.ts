import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  RsvpFormToken,
  RsvpSubmitInput,
  RsvpSubmitResult,
  OwnWishView,
  TelegramGuestSession,
  WishAddInput,
} from '@taklifnoma/shared';
import { firstValueFrom } from 'rxjs';
import { request } from './api-error';

@Injectable({ providedIn: 'root' })
export class RsvpApi {
  private readonly http = inject(HttpClient);

  private base(slug: string): string {
    return `/api/public/invitations/${encodeURIComponent(slug)}`;
  }

  async token(slug: string): Promise<string> {
    const res = await request(
      firstValueFrom(this.http.get<RsvpFormToken>(`${this.base(slug)}/rsvp-token`)),
    );
    return res.token;
  }

  submit(slug: string, body: RsvpSubmitInput): Promise<RsvpSubmitResult> {
    return request(firstValueFrom(this.http.post<RsvpSubmitResult>(`${this.base(slug)}/rsvp`, body)));
  }

  /** Mini App: Telegram foydalanuvchisi va uning avvalgi javobi. */
  telegramSession(slug: string, initData: string): Promise<TelegramGuestSession> {
    return request(
      firstValueFrom(this.http.post<TelegramGuestSession>(`${this.base(slug)}/tg-session`, { initData })),
    );
  }

  /** Javob bergan mehmon yana tilak qo'shadi. */
  addWish(slug: string, body: WishAddInput): Promise<OwnWishView> {
    return request(firstValueFrom(this.http.post<OwnWishView>(`${this.base(slug)}/wishes`, body)));
  }

  wishesUrl(slug: string, version: number): string {
    // v: o'z tilagini yuborgandan keyin brauzer keshini chetlab o'tish uchun.
    return `${this.base(slug)}/wishes?v=${version}`;
  }
}
