import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { RsvpFormToken, RsvpSubmitInput, RsvpSubmitResult } from '@taklifnoma/shared';
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

  wishesUrl(slug: string, version: number): string {
    // v: o'z tilagini yuborgandan keyin brauzer keshini chetlab o'tish uchun.
    return `${this.base(slug)}/wishes?v=${version}`;
  }
}
