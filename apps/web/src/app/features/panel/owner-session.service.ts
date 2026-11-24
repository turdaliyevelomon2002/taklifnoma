import { inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { OwnerProfile } from '@taklifnoma/shared';
import { toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';

/** Owner sessiyasi: profil bir marta olinadi va keshlanadi. */
@Injectable({ providedIn: 'root' })
export class OwnerSession {
  private readonly api = inject(OwnerApi);
  readonly profile = signal<OwnerProfile | null>(null);
  private pending: Promise<OwnerProfile | null> | null = null;

  /** Sessiya bormi? (401 bo'lsa null). */
  ensure(): Promise<OwnerProfile | null> {
    if (this.profile()) return Promise.resolve(this.profile());
    this.pending ??= this.api
      .me()
      .then((p) => {
        this.profile.set(p);
        return p;
      })
      .catch((err) => {
        if (toApiError(err).status !== 401) throw err;
        return null;
      })
      .finally(() => (this.pending = null));
    return this.pending;
  }

  async login(email: string, password: string): Promise<void> {
    await this.api.login(email, password);
    this.profile.set(await this.api.me());
  }

  async logout(): Promise<void> {
    await this.api.logout().catch(() => undefined);
    this.profile.set(null);
  }
}

/** Kirilmagan bo'lsa /panel/login?next=... ga yo'naltiradi. */
export const ownerGuard: CanActivateFn = async (_route, state) => {
  const session = inject(OwnerSession);
  const router = inject(Router);
  try {
    if (await session.ensure()) return true;
  } catch {
    /* tarmoq xatosi: login sahifasi xabarni ko'rsatadi */
  }
  return router.createUrlTree(['/panel/login'], { queryParams: { next: state.url } });
};
