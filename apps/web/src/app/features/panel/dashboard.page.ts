import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  INVITATION_STATUSES,
  PACKAGE_TYPES,
  type InvitationListItem,
  type InvitationStatus,
  type OwnerDashboard,
  type PackageType,
} from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';
import { LangService } from '../../core/i18n/lang.service';
import { EventDatePipe } from '../../shared/date/event-date.pipe';
import { MoneyPipe } from './money.pipe';

const PAGE_SIZE = 20;
const LIST_TZ = 'Asia/Tashkent';

@Component({
  selector: 'tk-panel-dashboard',
  imports: [RouterLink, TranslocoPipe, EventDatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class PanelDashboardPage {
  private readonly api = inject(OwnerApi);
  protected readonly lang = inject(LangService).lang;
  protected readonly tz = LIST_TZ;
  protected readonly statuses = INVITATION_STATUSES;
  protected readonly packages = PACKAGE_TYPES;

  protected readonly summary = signal<OwnerDashboard | null>(null);
  protected readonly items = signal<InvitationListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly status = signal<InvitationStatus | ''>('');
  protected readonly pkg = signal<PackageType | ''>('');
  protected readonly sort = signal<'createdAt' | 'eventDate'>('createdAt');
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  private seq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => {
      this.api.dashboard().then((d) => this.summary.set(d), () => undefined);
    });
    effect(() => {
      const query = {
        status: this.status() || undefined,
        package: this.pkg() || undefined,
        sort: this.sort(),
        order: this.sort() === 'eventDate' ? ('asc' as const) : ('desc' as const),
        q: this.q() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      };
      untracked(() => void this.load(query));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  private async load(query: Parameters<OwnerApi['list']>[0]): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.list(query);
      if (seq !== this.seq) return;
      this.items.set(res.items);
      this.total.set(res.total);
    } catch (err) {
      if (seq === this.seq) this.error.set(errorKey(toApiError(err).code));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.q.set(value.trim());
    }, 300);
  }

  protected setStatus(value: InvitationStatus | ''): void {
    this.page.set(1);
    this.status.set(value);
  }

  protected setPackage(value: PackageType | ''): void {
    this.page.set(1);
    this.pkg.set(value);
  }

  protected setSort(value: 'createdAt' | 'eventDate'): void {
    this.page.set(1);
    this.sort.set(value);
  }

  protected pages(): number {
    return Math.max(1, Math.ceil(this.total() / PAGE_SIZE));
  }

  protected isUnpaid(item: InvitationListItem): boolean {
    return !item.paidAt && (item.price ?? 0) > 0 && item.status !== 'ARCHIVED';
  }
}
