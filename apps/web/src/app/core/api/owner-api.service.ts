import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ChangeStatusInput,
  CoupleAccessCredentials,
  CreateInvitationInput,
  CreateInvitationResult,
  GuestListQuery,
  GuestPage,
  GuestView,
  InvitationDetail,
  InvitationListItem,
  ListInvitationsQuery,
  Locale,
  MediaKindParam,
  MediaView,
  OwnerDashboard,
  OwnerProfile,
  Paginated,
  PublicInvitation,
  TelegramLinkInfo,
  UpdateInvitationInput,
} from '@taklifnoma/shared';
import { firstValueFrom, type Observable } from 'rxjs';
import { request, toApiError } from './api-error';
import type { GuestSource } from './guest-source';

const BASE = '/api/owner';

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

/** Owner paneli API'si. Sessiya httpOnly cookie'da (tk_owner). */
@Injectable({ providedIn: 'root' })
export class OwnerApi {
  private readonly http = inject(HttpClient);

  private run<T>(obs: Observable<T>): Promise<T> {
    return request(firstValueFrom(obs));
  }

  // --- Auth ---
  login(email: string, password: string): Promise<void> {
    return this.run(this.http.post<void>(`${BASE}/auth/login`, { email, password }));
  }
  logout(): Promise<void> {
    return this.run(this.http.post<void>(`${BASE}/auth/logout`, {}));
  }
  me(): Promise<OwnerProfile> {
    return this.run(this.http.get<OwnerProfile>(`${BASE}/auth/me`));
  }
  telegram(): Promise<TelegramLinkInfo> {
    return this.run(this.http.get<TelegramLinkInfo>(`${BASE}/telegram`));
  }

  // --- Buyurtmalar ---
  dashboard(): Promise<OwnerDashboard> {
    return this.run(this.http.get<OwnerDashboard>(`${BASE}/dashboard`));
  }
  list(query: Partial<ListInvitationsQuery>): Promise<Paginated<InvitationListItem>> {
    return this.run(
      this.http.get<Paginated<InvitationListItem>>(`${BASE}/invitations`, { params: toParams(query) }),
    );
  }
  slugAvailable(slug: string): Promise<boolean> {
    return this.run(
      this.http.get<{ available: boolean }>(`${BASE}/invitations/slug-check`, { params: { slug } }),
    ).then((r) => r.available);
  }
  create(input: CreateInvitationInput): Promise<CreateInvitationResult> {
    return this.run(this.http.post<CreateInvitationResult>(`${BASE}/invitations`, input));
  }
  get(id: string): Promise<InvitationDetail> {
    return this.run(this.http.get<InvitationDetail>(`${BASE}/invitations/${id}`));
  }
  preview(id: string): Promise<PublicInvitation> {
    return this.run(this.http.get<PublicInvitation>(`${BASE}/invitations/${id}/preview`));
  }
  update(id: string, input: UpdateInvitationInput): Promise<InvitationDetail> {
    return this.run(this.http.patch<InvitationDetail>(`${BASE}/invitations/${id}`, input));
  }
  changeStatus(id: string, status: ChangeStatusInput['status']): Promise<InvitationDetail> {
    return this.run(this.http.post<InvitationDetail>(`${BASE}/invitations/${id}/status`, { status }));
  }
  regenerateAccess(id: string): Promise<CoupleAccessCredentials> {
    return this.run(
      this.http.post<CoupleAccessCredentials>(`${BASE}/invitations/${id}/access/regenerate`, {}),
    );
  }
  remove(id: string): Promise<void> {
    return this.run(this.http.delete<void>(`${BASE}/invitations/${id}`));
  }

  // --- Media ---
  uploadMedia(id: string, kind: MediaKindParam, file: File): Promise<MediaView> {
    const form = new FormData();
    form.append('file', file);
    return this.run(this.http.post<MediaView>(`${BASE}/invitations/${id}/media/${kind}`, form));
  }
  reorderGallery(id: string, ids: string[]): Promise<MediaView[]> {
    return this.run(
      this.http.patch<MediaView[]>(`${BASE}/invitations/${id}/media/gallery/order`, { ids }),
    );
  }
  deleteMedia(id: string, mediaId: string): Promise<void> {
    return this.run(this.http.delete<void>(`${BASE}/invitations/${id}/media/${mediaId}`));
  }

  /** Bitta taklifnoma mehmonlari: GuestListComponent uchun manba. */
  guestSource(id: string): GuestSource {
    const base = `${BASE}/invitations/${id}/guests`;
    return {
      listGuests: (query: GuestListQuery) =>
        this.run(this.http.get<GuestPage>(base, { params: toParams(query) })),
      setWishHidden: (rsvpId: string, hidden: boolean) =>
        this.run(this.http.patch<GuestView>(`${base}/${rsvpId}/wish`, { hidden })),
      removeGuest: (rsvpId: string) => this.run(this.http.delete<void>(`${base}/${rsvpId}`)),
      exportExcel: (lang: Locale) => this.download(`${base}/export`, { lang }),
    };
  }

  private async download(url: string, params: Record<string, string>) {
    try {
      const res = await firstValueFrom(
        this.http.get(url, { params, responseType: 'blob', observe: 'response' }),
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
