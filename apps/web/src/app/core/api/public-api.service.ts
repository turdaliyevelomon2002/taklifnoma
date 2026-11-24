import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import type { PublicInvitation } from '@taklifnoma/shared';
import { catchError, map, Observable, of, tap } from 'rxjs';

export type LoadResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);
  private readonly state = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  /**
   * SSR natijasi TransferState orqali HTML ichida brauzerga uzatiladi: hydration paytida
   * API'ga qayta so'rov ketmaydi va sahifa server ko'rsatganining aynan o'zi bo'lib qoladi.
   */
  invitation(slug: string): Observable<LoadResult<PublicInvitation>> {
    const key = makeStateKey<LoadResult<PublicInvitation>>(`invitation:${slug}`);
    const cached = this.state.get(key, null);
    if (cached) {
      this.state.remove(key);
      return of(cached);
    }

    return this.http.get<PublicInvitation>(`/api/public/invitations/${encodeURIComponent(slug)}`).pipe(
      map((data): LoadResult<PublicInvitation> => ({ status: 'ok', data })),
      catchError((err: unknown) =>
        of<LoadResult<PublicInvitation>>(
          err instanceof HttpErrorResponse && err.status === 404
            ? { status: 'not-found' }
            : { status: 'error' },
        ),
      ),
      tap((result) => {
        if (this.isServer) this.state.set(key, result);
      }),
    );
  }
}
