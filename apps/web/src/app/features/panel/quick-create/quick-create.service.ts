import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject, signal } from '@angular/core';
import type { CreateInvitationResult } from '@taklifnoma/shared';

/**
 * Tezkor yaratish dialogini ochadi. Dialog kodi (Zod bilan) faqat birinchi ochilishda yuklanadi.
 * `created` signali ro'yxatlarni yangilash uchun.
 */
@Injectable({ providedIn: 'root' })
export class QuickCreate {
  private readonly dialog = inject(Dialog);
  readonly created = signal(0);

  isOpen(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  async open(): Promise<CreateInvitationResult | undefined> {
    const { QuickCreateDialog } = await import('./quick-create.dialog');
    const ref = this.dialog.open<CreateInvitationResult | undefined>(QuickCreateDialog, {
      panelClass: ['tk-dialog', 'tk-dialog--lg'],
      backdropClass: 'tk-dialog-backdrop',
      autoFocus: 'first-tabbable',
      disableClose: false,
    });
    return new Promise((resolve) => ref.closed.subscribe(resolve));
  }
}
