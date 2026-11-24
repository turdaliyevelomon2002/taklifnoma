import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ErrorStateComponent } from '../status/error-state.component';
import { NotFoundComponent } from '../status/not-found.component';
import type { InvitationRouteData } from './invitation.resolver';
import { MusicPlayer } from './music-player.service';
import { WishesStore } from './wishes.store';

/**
 * /{slug}: resolver tanlagan shablonni dinamik render qiladi.
 * Sahifa kodi shablonga bog'liq emas: yangi shablon qo'shish uchun faqat registry yangilanadi.
 */
@Component({
  selector: 'tk-invitation-page',
  imports: [NgComponentOutlet, NotFoundComponent, ErrorStateComponent],
  providers: [MusicPlayer, WishesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ok(); as data) {
      <ng-container *ngComponentOutlet="data.component; inputs: { invitation: data.invitation }" />
    } @else if (result().status === 'not-found') {
      <tk-not-found />
    } @else {
      <tk-error-state />
    }
  `,
})
export class InvitationPage {
  /** Resolver natijasi (withComponentInputBinding orqali). */
  readonly result = input.required<InvitationRouteData>();

  protected readonly ok = computed(() => {
    const r = this.result();
    return r.status === 'ok' ? r : null;
  });
}
