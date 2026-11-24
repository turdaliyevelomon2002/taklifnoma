import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { GuestFilter, GuestSort, GuestView, RsvpStats } from '@taklifnoma/shared';
import { formatUzPhone } from '@taklifnoma/shared/phone';
import { errorKey, toApiError } from '../../../core/api/api-error';
import type { GuestSource } from '../../../core/api/guest-source';
import { LangService } from '../../../core/i18n/lang.service';
import { EventDatePipe } from '../../date/event-date.pipe';

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'tk-guest-list',
  imports: [TranslocoPipe, EventDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guest-list.component.html',
  styleUrl: './guest-list.component.scss',
})
export class GuestListComponent {
  readonly source = input.required<GuestSource>();
  readonly stats = input.required<RsvpStats>();
  readonly timezone = input.required<string>();
  /** Excel eksport paketda bormi (juftlik) yoki har doim (owner). */
  readonly canExport = input(false);
  /** Tilaklar devori yoqilgan bo'lsa tilakni yashirish tugmasi ko'rinadi. */
  readonly wishModeration = input(false);
  /** Ma'lumot o'zgardi (o'chirildi): ota komponent statistikani yangilaydi. */
  readonly changed = output<void>();

  private readonly document = inject(DOCUMENT);
  protected readonly lang = inject(LangService).lang;

  protected readonly filters: GuestFilter[] = ['all', 'attending', 'declined'];
  protected readonly sorts: GuestSort[] = ['newest', 'oldest', 'name'];

  protected readonly filter = signal<GuestFilter>('all');
  protected readonly sort = signal<GuestSort>('newest');
  /** Debounce'dan keyingi qidiruv matni. */
  protected readonly query = signal('');

  protected readonly items = signal<GuestView[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private page = 1;
  /** Eski so'rov javobi yangisini bosib ketmasligi uchun. */
  private requestSeq = 0;

  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Filtr, saralash yoki qidiruv o'zgarsa birinchi sahifadan qayta yuklanadi.
    effect(() => {
      const params = { filter: this.filter(), sort: this.sort(), q: this.query() };
      untracked(() => void this.load(params, 1));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.query.set(value.trim()), SEARCH_DEBOUNCE_MS);
  }

  protected loadMore(): void {
    void this.load({ filter: this.filter(), sort: this.sort(), q: this.query() }, this.page + 1);
  }

  protected reload(): void {
    void this.load({ filter: this.filter(), sort: this.sort(), q: this.query() }, 1);
  }

  private async load(params: { filter: GuestFilter; sort: GuestSort; q: string }, page: number) {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.source().listGuests({ ...params, q: params.q || undefined, page, pageSize: PAGE_SIZE });
      if (seq !== this.requestSeq) return;
      this.page = page;
      this.total.set(res.total);
      this.items.update((current) => (page === 1 ? res.items : [...current, ...res.items]));
    } catch (err) {
      if (seq === this.requestSeq) this.error.set(errorKey(toApiError(err).code));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected phone(value: string): string {
    return formatUzPhone(value);
  }

  protected async toggleWish(guest: GuestView): Promise<void> {
    this.busyId.set(guest.id);
    try {
      const updated = await this.source().setWishHidden(guest.id, !guest.wishHidden);
      this.items.update((list) => list.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async remove(guest: GuestView): Promise<void> {
    this.busyId.set(guest.id);
    try {
      await this.source().removeGuest(guest.id);
      this.items.update((list) => list.filter((g) => g.id !== guest.id));
      this.total.update((n) => Math.max(0, n - 1));
      this.confirmDeleteId.set(null);
      this.changed.emit();
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async exportExcel(): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      const { blob, fileName } = await this.source().exportExcel(this.lang());
      const url = URL.createObjectURL(blob);
      const a = this.document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      this.exportError.set(errorKey(toApiError(err).code));
    } finally {
      this.exporting.set(false);
    }
  }
}
