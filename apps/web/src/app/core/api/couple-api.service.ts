import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CoupleSessionInfo,
  GuestListQuery,
  GuestPage,
  GuestView,
  Locale,
} from '@taklifnoma/shared';
import { firstValueFrom } from 'rxjs';
import { request, toApiError } from './api-error';
import type { GuestSource } from './guest-source';

/** Juftlik paneli API'si. Sessiya httpOnly cookie'da (tk_couple), JS unga tegmaydi. */
@Injectable({ providedIn: 'root' })
export class CoupleApi implements GuestSource {
  private readonly http = inject(HttpClient);

  loginWithToken(slug: string, token: string): Promise<void> {
    return request(firstValueFrom(this.http.post<void>('/api/couple/auth/token', { slug, token })));
  }

  loginWithPin(slug: string, pin: string): Promise<void> {
    return request(firstValueFrom(this.http.post<void>('/api/couple/auth/pin', { slug, pin })));
  }

  logout(): Promise<void> {
    return request(firstValueFrom(this.http.post<void>('/api/couple/auth/logout', {})));
  }

  me(): Promise<CoupleSessionInfo> {
    return request(firstValueFrom(this.http.get<CoupleSessionInfo>('/api/couple/me')));
  }

  listGuests(query: GuestListQuery): Promise<GuestPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return request(firstValueFrom(this.http.get<GuestPage>('/api/couple/guests', { params })));
  }

  setWishHidden(id: string, hidden: boolean): Promise<GuestView> {
    return request(
      firstValueFrom(this.http.patch<GuestView>(`/api/couple/guests/${id}/wish`, { hidden })),
    );
  }

  removeGuest(id: string): Promise<void> {
    return request(firstValueFrom(this.http.delete<void>(`/api/couple/guests/${id}`)));
  }

  /** Excel faylini Blob sifatida oladi. Xato bo'lsa tanasi ham Blob: JSON'ga aylantiriladi. */
  async exportExcel(lang: Locale): Promise<{ blob: Blob; fileName: string }> {
    try {
      const res = await firstValueFrom(
        this.http.get('/api/couple/guests/export', {
          params: { lang },
          responseType: 'blob',
          observe: 'response',
        }),
      );
      const disposition = res.headers.get('content-disposition') ?? '';
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'guests.xlsx';
      return { blob: res.body!, fileName };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
        const body: unknown = await err.error.text().then(JSON.parse).catch(() => null);
        throw toApiError(new HttpErrorResponse({ error: body, status: err.status }));
      }
      throw toApiError(err);
    }
  }
}
