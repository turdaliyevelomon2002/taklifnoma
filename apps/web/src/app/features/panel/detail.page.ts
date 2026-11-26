import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CoupleAccessCredentials, InvitationDetail, InvitationStatus } from '@taklifnoma/shared';
import { firstValueFrom } from 'rxjs';
import { errorKey, toApiError } from '../../core/api/api-error';
import type { GuestSource } from '../../core/api/guest-source';
import { OwnerApi } from '../../core/api/owner-api.service';
import { LangService } from '../../core/i18n/lang.service';
import { EventDatePipe } from '../../shared/date/event-date.pipe';
import { GuestListComponent } from '../../shared/guests/guest-list/guest-list.component';
import { CredentialsCardComponent } from './credentials-card.component';
import { DeleteDialogComponent, type DeleteDialogData } from './detail/delete-dialog.component';
import { DetailOverviewComponent, type OverviewTarget } from './detail/overview.component';
import { InvitationEditorComponent } from './editor/invitation-editor.component';
import { confirmDiscard, type HasUnsavedChanges } from './editor/unsaved-changes.guard';
import { MediaManagerComponent } from './media-manager.component';
import { MoneyPipe } from './money.pipe';
import { QuickCreate } from './quick-create/quick-create.service';
import { PanelConfirm } from './ui/confirm.service';
import { IconComponent, type IconName } from './ui/icon.component';
import { PanelToasts } from './ui/toast.service';

export const DETAIL_TABS = ['overview', 'info', 'media', 'guests', 'access'] as const;
type Tab = (typeof DETAIL_TABS)[number];

const TAB_ICONS: Record<Tab, IconName> = {
  overview: 'layout-dashboard',
  info: 'pencil',
  media: 'image',
  guests: 'users',
  access: 'lock',
};

@Component({
  selector: 'tk-panel-detail',
  imports: [
    RouterLink,
    TranslocoPipe,
    EventDatePipe,
    MoneyPipe,
    InvitationEditorComponent,
    MediaManagerComponent,
    GuestListComponent,
    CredentialsCardComponent,
    DetailOverviewComponent,
    IconComponent,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail.page.html',
  styleUrl: './detail.page.scss',
})
export class PanelDetailPage implements HasUnsavedChanges {
  /** Route parametrlari (withComponentInputBinding). */
  readonly id = input.required<string>();
  readonly tab = input<string>();
  readonly section = input<string>();

  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly i18n = inject(LangService);
  private readonly confirm = inject(PanelConfirm);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(PanelToasts);
  private readonly editor = viewChild(InvitationEditorComponent);
  protected readonly lang = this.i18n.lang;
  protected readonly tabs = DETAIL_TABS;
  protected readonly tabIcons = TAB_ICONS;
  protected readonly menuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  protected readonly detail = signal<InvitationDetail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Yangi kirish ma'lumotlari: faqat qayta generatsiyadan keyin, bir marta. */
  protected readonly credentials = signal<CoupleAccessCredentials | null>(null);

  protected readonly activeTab = computed<Tab>(() => {
    const t = this.tab();
    return (DETAIL_TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'overview';
  });
  protected readonly guestSource = computed<GuestSource>(() => this.api.guestSource(this.id()));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
    // Tezkor yaratishdan keyin ham shu sahifa ochiq bo'lsa, ma'lumot yangilansin.
    const quick = inject(QuickCreate);
    effect(() => {
      if (quick.created()) untracked(() => void this.load());
    });
  }

  protected async load(id = this.id()): Promise<void> {
    try {
      this.detail.set(await this.api.get(id));
      this.loadError.set(null);
    } catch (err) {
      this.loadError.set(errorKey(toApiError(err).code));
    }
  }

  hasUnsavedChanges(): boolean {
    return this.editor()?.dirty() ?? false;
  }

  protected async selectTab(tab: Tab, section?: string): Promise<void> {
    if (tab === this.activeTab() && !section) return;
    // Tab almashganda muharrir yopiladi: saqlanmagan o'zgarishlar yo'qolmasin.
    if (this.hasUnsavedChanges() && !(await confirmDiscard(this.confirm))) return;
    await this.router.navigate([], {
      queryParams: { tab: tab === 'overview' ? null : tab, section: section ?? null },
      replaceUrl: true,
    });
    if (section && tab === 'info') {
      // Muharrir allaqachon ochiq bo'lsa, faqat bo'limga o'tamiz.
      setTimeout(() => document.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  }

  protected goTo(target: OverviewTarget): void {
    void this.selectTab(target.tab, target.section);
  }

  protected onSaved(d: InvitationDetail): void {
    this.detail.set(d);
  }

  protected async setStatus(status: InvitationStatus): Promise<void> {
    const d = this.detail();
    if (!d || this.busy()) return;
    if (status === 'ARCHIVED') {
      const ok = await this.confirm.ask({
        title: 'panel.detail.archiveTitle',
        message: 'panel.detail.archiveText',
        confirm: 'panel.detail.archive',
      });
      if (!ok) return;
    }
    this.busy.set(true);
    try {
      this.detail.set(await this.api.changeStatus(d.id, status));
      this.toasts.success(`panel.list.status${status}`, { names: d.coupleNames });
    } catch (err) {
      const code = toApiError(err).code;
      this.toasts.error(errorKey(code));
      // Nima yetishmasligi "Umumiy" tabdagi ro'yxatda ko'rinadi.
      if (code === 'INVITATION_INCOMPLETE') void this.selectTab('overview');
    } finally {
      this.busy.set(false);
    }
  }

  protected async regenerate(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'panel.access.regenerateTitle',
      message: 'panel.access.regenerateWarn',
      confirm: 'panel.access.regenerateConfirm',
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      this.credentials.set(await this.api.regenerateAccess(this.id()));
      this.toasts.success('panel.access.regenerated');
      void this.selectTab('access');
      await this.load();
    } catch (err) {
      this.toasts.error(errorKey(toApiError(err).code));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const d = this.detail();
    if (!d) return;
    const ref = this.dialog.open<boolean, DeleteDialogData>(DeleteDialogComponent, {
      data: { slug: d.slug, names: d.coupleNames, replies: d.stats.replies },
      panelClass: 'tk-dialog',
      backdropClass: 'tk-dialog-backdrop',
      role: 'alertdialog',
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.busy.set(true);
    try {
      await this.api.remove(d.id);
      this.toasts.success('panel.delete.done', { names: d.coupleNames });
      await this.router.navigateByUrl('/panel');
    } catch (err) {
      this.toasts.error(errorKey(toApiError(err).code));
    } finally {
      this.busy.set(false);
    }
  }

  protected shareText(d: InvitationDetail, c: CoupleAccessCredentials): string {
    return this.i18n.translate('panel.access.shareMessage', {
      names: d.coupleNames,
      url: d.publicUrl,
      adminUrl: c.adminUrl,
      pin: c.pin,
    });
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.success('panel.access.copied');
    } catch {
      this.toasts.error('panel.list.copyFailed');
    }
  }
}
