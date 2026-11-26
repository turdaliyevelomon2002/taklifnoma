import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { InvitationListItem, OwnerDashboard } from '@taklifnoma/shared';
import {
  INVITATION_STATUSES,
  PACKAGE_TYPES,
  type InvitationStatus,
  type PackageType,
} from '@taklifnoma/shared/enums';
import { formatUzPhone } from '@taklifnoma/shared/phone';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';
import { LangService } from '../../core/i18n/lang.service';
import { EventDatePipe } from '../../shared/date/event-date.pipe';
import { zonedParts } from '../../shared/date/datetime';
import { MoneyPipe } from './money.pipe';
import { QuickCreate } from './quick-create/quick-create.service';
import { IconComponent } from './ui/icon.component';
import { PanelToasts } from './ui/toast.service';

const PAGE_SIZE = 20;
const LIST_TZ = 'Asia/Tashkent';
const DAY_MS = 24 * 3600 * 1000;

type SortKey = 'createdAt' | 'eventDate';

@Component({
  selector: 'tk-panel-dashboard',
  imports: [RouterLink, TranslocoPipe, EventDatePipe, MoneyPipe, IconComponent, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class PanelDashboardPage {
  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(PanelToasts);
  protected readonly quick = inject(QuickCreate);
  protected readonly lang = inject(LangService).lang;
  protected readonly tz = LIST_TZ;
  protected readonly statuses = INVITATION_STATUSES;
  protected readonly packages = PACKAGE_TYPES;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly menuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly summary = signal<OwnerDashboard | null>(null);
  protected readonly items = signal<InvitationListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Amal bajarilayotgan qator (takroriy bosishning oldini oladi). */
  protected readonly busyId = signal<string | null>(null);

  protected readonly status = signal<InvitationStatus | ''>('');
  protected readonly pkg = signal<PackageType | ''>('');
  protected readonly sort = signal<SortKey>('createdAt');
  protected readonly q = signal('');
  protected readonly searchText = signal('');
  protected readonly page = signal(1);
  /** Qo'lda yangilash (status o'zgargandan keyin). */
  private readonly refresh = signal(0);

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  protected readonly range = computed(() => {
    const from = this.total() ? (this.page() - 1) * PAGE_SIZE + 1 : 0;
    return { from, to: Math.min(this.page() * PAGE_SIZE, this.total()), total: this.total() };
  });
  protected readonly hasFilters = computed(() => !!(this.status() || this.pkg() || this.q()));

  private seq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      // Yangi taklifnoma yaratilganda yoki holat o'zgarganda statistikani ham yangilaymiz.
      this.quick.created();
      this.refresh();
      untracked(() => void this.loadSummary());
    });
    effect(() => {
      this.quick.created();
      this.refresh();
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

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await this.api.dashboard());
    } catch {
      // KPI'lar ixtiyoriy: ro'yxat xatosi alohida ko'rsatiladi.
    }
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

  private reload(): void {
    this.refresh.update((n) => n + 1);
  }

  protected onSearch(value: string): void {
    this.searchText.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.q.set(value.trim());
    }, 300);
  }

  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.searchText.set('');
    this.q.set('');
    this.status.set('');
    this.pkg.set('');
    this.page.set(1);
  }

  protected setStatus(value: InvitationStatus | ''): void {
    this.page.set(1);
    this.status.set(value);
  }

  protected setPackage(value: PackageType | ''): void {
    this.page.set(1);
    this.pkg.set(value);
  }

  protected setSort(value: SortKey): void {
    this.page.set(1);
    this.sort.set(value);
  }

  protected statusCount(s: OwnerDashboard, status: InvitationStatus | ''): number {
    return status ? s.counts[status] : s.counts.total;
  }

  protected isUnpaid(item: InvitationListItem): boolean {
    return !item.paidAt && (item.price ?? 0) > 0 && item.status !== 'ARCHIVED';
  }

  protected phone(value: string): string {
    return formatUzPhone(value);
  }

  protected initials(names: string): string {
    return names
      .split('&')
      .map((p) => p.trim().charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /** To'ygacha qolgan kunlar (taklifnoma vaqt mintaqasida, kalendar kunlari bo'yicha). */
  protected daysLeft(iso: string): number {
    const day = (d: string) => {
      const p = zonedParts(d, LIST_TZ);
      return Date.UTC(p.year, p.month - 1, p.day);
    };
    return Math.round((day(iso) - day(new Date().toISOString())) / DAY_MS);
  }

  protected dateParts(iso: string): { day: number; month: number } {
    const p = zonedParts(iso, LIST_TZ);
    return { day: p.day, month: p.month };
  }

  protected publicUrl(item: InvitationListItem): string {
    return `${location.origin}/${item.slug}`;
  }

  protected open(item: InvitationListItem): void {
    void this.router.navigate(['/panel/i', item.id]);
  }

  protected async copyLink(item: InvitationListItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl(item));
      this.toasts.success('panel.list.linkCopied');
    } catch {
      this.toasts.error('panel.list.copyFailed');
    }
  }

  protected async changeStatus(item: InvitationListItem, status: InvitationStatus): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    try {
      await this.api.changeStatus(item.id, status);
      this.toasts.success(`panel.list.status${status}`, { names: item.coupleNames });
      this.reload();
    } catch (err) {
      const code = toApiError(err).code;
      if (code === 'INVITATION_INCOMPLETE') {
        // Nima yetishmasligini muharrirda ko'rsatamiz.
        this.toasts.error('errors.INVITATION_INCOMPLETE');
        void this.router.navigate(['/panel/i', item.id]);
      } else {
        this.toasts.error(errorKey(code));
      }
    } finally {
      this.busyId.set(null);
    }
  }
}
