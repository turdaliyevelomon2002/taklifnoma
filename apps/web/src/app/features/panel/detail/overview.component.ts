import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { InvitationDetail } from '@taklifnoma/shared';
import { formatUzPhone } from '@taklifnoma/shared/phone';
import { LangService } from '../../../core/i18n/lang.service';
import { zonedParts } from '../../../shared/date/datetime';
import { EventDatePipe } from '../../../shared/date/event-date.pipe';
import { MoneyPipe } from '../money.pipe';
import { IconComponent, type IconName } from '../ui/icon.component';
import { PanelToasts } from '../ui/toast.service';

export interface OverviewTarget {
  tab: 'info' | 'media' | 'guests' | 'access';
  section?: string;
}

interface CheckItem {
  key: string;
  ok: boolean;
  /** Majburiy (chop etish uchun) yoki tavsiya. */
  required: boolean;
  target: OverviewTarget;
}

const DAY_MS = 24 * 3600 * 1000;

@Component({
  selector: 'tk-detail-overview',
  imports: [TranslocoPipe, IconComponent, EventDatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = invitation();
    @let l = lang();
    @let r = readiness();

    <div class="ov">
      <div class="ov__main">
        <!-- Statistika -->
        <section class="stats">
          @for (s of stats(); track s.key) {
            <button type="button" class="stat" (click)="go.emit({ tab: 'guests' })">
              <span class="stat__icon stat__icon--{{ s.tone }}"><tk-icon [name]="s.icon" /></span>
              <span class="stat__value">{{ s.value }}</span>
              <span class="stat__label">{{ 'panel.overview.stats.' + s.key | transloco }}</span>
            </button>
          }
        </section>

        <!-- Tayyorlik -->
        <section class="card">
          <div class="card__head">
            <div>
              <h2 class="card__title">{{ 'panel.overview.readiness' | transloco }}</h2>
              <p class="muted ov__sub">
                {{ (r.missingRequired ? 'panel.overview.readinessMissing' : 'panel.overview.readinessOk') | transloco: { count: r.missingRequired } }}
              </p>
            </div>
            <div class="ring" [style.--p]="r.percent" role="img" [attr.aria-label]="r.percent + '%'">
              <span>{{ r.percent }}%</span>
            </div>
          </div>
          <ul class="checks">
            @for (c of r.items; track c.key) {
              <li class="check-item" [class.is-ok]="c.ok">
                <span class="check-item__mark"><tk-icon [name]="c.ok ? 'check' : c.required ? 'alert-triangle' : 'info'" /></span>
                <span class="check-item__text">
                  {{ 'panel.overview.check.' + c.key | transloco }}
                  @if (!c.required) { <small>{{ 'panel.overview.recommended' | transloco }}</small> }
                </span>
                @if (!c.ok) {
                  <button type="button" class="btn btn--outline btn--sm" (click)="go.emit(c.target)">
                    {{ 'panel.overview.fill' | transloco }} <tk-icon name="chevron-right" />
                  </button>
                }
              </li>
            }
          </ul>
          @if (d.status === 'DRAFT') {
            <div class="publish">
              <p class="muted">{{ (r.missingRequired ? 'panel.overview.publishBlocked' : 'panel.overview.publishReady') | transloco }}</p>
              <button type="button" class="btn btn--primary" [disabled]="!!r.missingRequired || busy()" (click)="publish.emit()">
                <tk-icon name="send" /> {{ 'panel.detail.publish' | transloco }}
              </button>
            </div>
          }
        </section>
      </div>

      <aside class="ov__side">
        <!-- To'ygacha -->
        <section class="card when">
          <span class="when__date">{{ d.eventDate | eventDate: 'full' : d.config.timezone : l }}</span>
          @let left = daysLeft();
          <span class="when__left">
            @if (left > 1) {
              {{ 'panel.dashboard.inDays' | transloco: { count: left } }}
            } @else if (left === 1) {
              {{ 'panel.dashboard.tomorrow' | transloco }}
            } @else if (left === 0) {
              {{ 'panel.dashboard.today' | transloco }}
            } @else {
              {{ 'panel.list.past' | transloco }}
            }
          </span>
        </section>

        <!-- Ulashish -->
        <section class="card">
          <h2 class="card__title">{{ 'panel.overview.share' | transloco }}</h2>
          @if (d.status !== 'ACTIVE') {
            <p class="hint ov__hint"><tk-icon name="lock" /> {{ 'panel.overview.notPublic' | transloco }}</p>
          }
          <div class="copy-field">
            <tk-icon name="link" />
            <span class="copy-field__value">{{ d.publicUrl }}</span>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="copy(d.publicUrl)" [attr.aria-label]="'panel.list.copyLink' | transloco" [attr.title]="'panel.list.copyLink' | transloco"><tk-icon name="copy" /></button>
          </div>
          <div class="share-actions">
            <a class="btn btn--outline btn--sm" [href]="telegramShareUrl()" target="_blank" rel="noopener" [class.is-disabled]="d.status !== 'ACTIVE'">
              <tk-icon name="send" /> Telegram
            </a>
            @if (d.status === 'ACTIVE') {
              <a class="btn btn--outline btn--sm" [href]="d.publicUrl" target="_blank" rel="noopener">
                <tk-icon name="external-link" /> {{ 'panel.list.viewPage' | transloco }}
              </a>
            }
          </div>
          @if (d.telegramAppUrl; as app) {
            <p class="label ov__label">{{ 'panel.access.miniAppTitle' | transloco }}</p>
            <div class="copy-field">
              <tk-icon name="smartphone" />
              <span class="copy-field__value">{{ app }}</span>
              <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="copy(app)" [attr.aria-label]="'panel.access.copy' | transloco"><tk-icon name="copy" /></button>
            </div>
          }
        </section>

        <!-- Buyurtma -->
        <section class="card">
          <div class="card__head">
            <h2 class="card__title">{{ 'panel.form.sections.order' | transloco }}</h2>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="go.emit({ tab: 'info', section: 'order' })" [attr.aria-label]="'panel.list.openEdit' | transloco"><tk-icon name="pencil" /></button>
          </div>
          <dl class="facts">
            <dt>{{ 'panel.list.customer' | transloco }}</dt>
            <dd>{{ d.customerName }}<br /><a [href]="'tel:' + d.customerPhone">{{ phone() }}</a></dd>
            <dt>{{ 'panel.form.package' | transloco }}</dt>
            <dd>{{ 'admin.package.' + d.package | transloco }}</dd>
            <dt>{{ 'panel.list.price' | transloco }}</dt>
            <dd>
              {{ d.price | money: l }}
              @if (d.paidAt) {
                <span class="badge badge--ACTIVE">{{ 'panel.list.paid' | transloco }}</span>
              } @else if ((d.price ?? 0) > 0) {
                <span class="badge badge--unpaid">{{ 'panel.dashboard.notPaid' | transloco }}</span>
              }
            </dd>
            <dt>{{ 'panel.form.template' | transloco }}</dt>
            <dd>{{ 'panel.templates.' + d.templateKey + '.name' | transloco }}</dd>
          </dl>
          @if (d.notes) {
            <p class="notes">{{ d.notes }}</p>
          }
        </section>
      </aside>
    </div>
  `,
  styleUrl: './overview.component.scss',
})
export class DetailOverviewComponent {
  readonly invitation = input.required<InvitationDetail>();
  readonly busy = input(false);
  readonly go = output<OverviewTarget>();
  readonly publish = output<void>();

  protected readonly lang = inject(LangService).lang;
  private readonly i18n = inject(LangService);
  private readonly toasts = inject(PanelToasts);

  protected readonly stats = computed(() => {
    const s = this.invitation().stats;
    const items: { key: string; value: number; icon: IconName; tone: string }[] = [
      { key: 'guests', value: s.attendingGuests, icon: 'users', tone: 'ok' },
      { key: 'replies', value: s.replies, icon: 'mail', tone: 'primary' },
      { key: 'declined', value: s.notAttendingReplies, icon: 'x', tone: 'muted' },
      { key: 'pendingWishes', value: s.pendingWishes, icon: 'heart', tone: s.pendingWishes ? 'warn' : 'muted' },
    ];
    return items;
  });

  /** Chop etish uchun majburiy maydonlar serverdagi invitationConfigSchema bilan mos. */
  protected readonly readiness = computed(() => {
    const d = this.invitation();
    const c = d.config;
    const has = (kind: string) => d.media.some((m) => m.kind === kind);
    const items: CheckItem[] = [
      {
        key: 'names',
        ok: !!(c.couple.groom.firstName.uz?.trim() && c.couple.bride.firstName.uz?.trim()),
        required: true,
        target: { tab: 'info', section: 'couple' },
      },
      {
        key: 'venue',
        ok: c.events.every((e) => !!(e.venue.name?.uz?.trim() && e.venue.address?.uz?.trim())),
        required: true,
        target: { tab: 'info', section: 'events' },
      },
      {
        key: 'location',
        ok: c.events.every((e) => !!e.venue.location),
        required: true,
        target: { tab: 'info', section: 'events' },
      },
      { key: 'cover', ok: has('COVER'), required: false, target: { tab: 'media' } },
      { key: 'greeting', ok: !!c.greeting?.uz?.trim(), required: false, target: { tab: 'info', section: 'texts' } },
    ];
    if (d.features.music) items.push({ key: 'music', ok: has('MUSIC'), required: false, target: { tab: 'media' } });
    if (d.features.gallery) items.push({ key: 'gallery', ok: has('GALLERY'), required: false, target: { tab: 'media' } });
    if (d.features.telegramNotify) {
      items.push({ key: 'telegram', ok: d.coupleTelegramLinked, required: false, target: { tab: 'access' } });
    }
    const done = items.filter((i) => i.ok).length;
    return {
      items,
      percent: Math.round((done / items.length) * 100),
      missingRequired: items.filter((i) => i.required && !i.ok).length,
    };
  });

  protected readonly daysLeft = computed(() => {
    const d = this.invitation();
    const day = (iso: string) => {
      const p = zonedParts(iso, d.config.timezone);
      return Date.UTC(p.year, p.month - 1, p.day);
    };
    return Math.round((day(d.eventDate) - day(new Date().toISOString())) / DAY_MS);
  });

  protected readonly telegramShareUrl = computed(() => {
    const d = this.invitation();
    const text = this.i18n.translate('panel.overview.shareText', { names: d.coupleNames });
    return `https://t.me/share/url?url=${encodeURIComponent(d.publicUrl)}&text=${encodeURIComponent(text)}`;
  });

  protected readonly phone = computed(() => formatUzPhone(this.invitation().customerPhone));

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.success('panel.list.linkCopied');
    } catch {
      this.toasts.error('panel.list.copyFailed');
    }
  }
}
