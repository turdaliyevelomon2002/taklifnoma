import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type {
  CoupleAccessCredentials,
  InvitationDetail,
  InvitationStatus,
} from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../core/api/api-error';
import type { GuestSource } from '../../core/api/guest-source';
import { OwnerApi } from '../../core/api/owner-api.service';
import { LangService } from '../../core/i18n/lang.service';
import { EventDatePipe } from '../../shared/date/event-date.pipe';
import { GuestListComponent } from '../../shared/guests/guest-list/guest-list.component';
import { CredentialsCardComponent } from './credentials-card.component';
import { InvitationEditorComponent } from './editor/invitation-editor.component';
import { MediaManagerComponent } from './media-manager.component';
import { MoneyPipe } from './money.pipe';

export const DETAIL_TABS = ['info', 'media', 'guests', 'access'] as const;
type Tab = (typeof DETAIL_TABS)[number];

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail.page.html',
  styleUrl: './detail.page.scss',
})
export class PanelDetailPage {
  /** Route parametrlari (withComponentInputBinding). */
  readonly id = input.required<string>();
  readonly tab = input<string>();

  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly i18n = inject(LangService);
  protected readonly lang = this.i18n.lang;
  protected readonly tabs = DETAIL_TABS;

  protected readonly detail = signal<InvitationDetail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly credentials = signal<CoupleAccessCredentials | null>(null);
  protected readonly confirmRegenerate = signal(false);
  protected readonly deleteConfirmText = signal('');

  protected readonly activeTab = computed<Tab>(() => {
    const t = this.tab();
    return (DETAIL_TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'info';
  });
  protected readonly guestSource = computed<GuestSource>(() => this.api.guestSource(this.id()));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
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

  protected selectTab(tab: Tab): void {
    void this.router.navigate([], { queryParams: { tab: tab === 'info' ? null : tab }, replaceUrl: true });
  }

  protected onSaved(d: InvitationDetail): void {
    this.detail.set(d);
  }

  protected async setStatus(status: InvitationStatus): Promise<void> {
    await this.run(async () => this.detail.set(await this.api.changeStatus(this.id(), status)));
  }

  protected async regenerate(): Promise<void> {
    await this.run(async () => {
      this.credentials.set(await this.api.regenerateAccess(this.id()));
      this.confirmRegenerate.set(false);
      await this.load();
    });
  }

  protected async remove(): Promise<void> {
    await this.run(async () => {
      await this.api.remove(this.id());
      await this.router.navigateByUrl('/panel');
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await fn();
    } catch (err) {
      this.actionError.set(errorKey(toApiError(err).code));
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
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  }
}
