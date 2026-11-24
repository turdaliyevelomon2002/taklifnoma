import { Injectable, signal } from '@angular/core';

/** RSVP formasi va tilaklar devori o'rtasidagi aloqa (sahifa darajasida). */
@Injectable()
export class WishesStore {
  /** Yangi tilak qo'shilganda oshadi: tilaklar devori qayta yuklanadi. */
  readonly version = signal(0);

  bump(): void {
    this.version.update((v) => v + 1);
  }
}
