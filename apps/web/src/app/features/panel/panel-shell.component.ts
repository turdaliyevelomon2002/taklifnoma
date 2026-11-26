import { CdkMenu, CdkMenuGroup, CdkMenuItem, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TelegramLinkInfo } from '@taklifnoma/shared';
import { LOCALES, type Locale } from '@taklifnoma/shared/enums';
import { filter, map } from 'rxjs';
import { OwnerApi } from '../../core/api/owner-api.service';
import { isLocale, LangService } from '../../core/i18n/lang.service';
import { OwnerSession } from './owner-session.service';
import { QuickCreate } from './quick-create/quick-create.service';
import { IconComponent } from './ui/icon.component';
import { PanelTheme, type ThemeMode } from './ui/theme.service';
import { ToastOutletComponent } from './ui/toast.service';

const LANG_KEY = 'tk-panel-lang';
const SIDEBAR_KEY = 'tk-panel-sidebar';

/** /panel: sidebar + topbar + sahifalar. Faqat brauzerda render qilinadi. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

@Component({
  selector: 'tk-panel-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    IconComponent,
    ToastOutletComponent,
    CdkMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemRadio,
    CdkMenuGroup,
  ],
  providers: [PanelTheme],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="panel">
      @if (session.profile(); as me) {
        <div class="shell" [class.is-collapsed]="collapsed()" [class.is-mobile-open]="mobileOpen()">
          <aside class="sidebar" [attr.aria-label]="'panel.shell.menu' | transloco">
            <a class="sidebar__brand" routerLink="/panel">
              <span class="brand-mark"><tk-icon name="heart" /></span>
              <span class="sidebar__brand-text">
                <strong>Taklifnoma</strong>
                <span>{{ 'panel.shell.brandSub' | transloco }}</span>
              </span>
            </a>

            <nav class="sidebar__nav">
              <span class="sidebar__label">{{ 'panel.shell.menu' | transloco }}</span>
              <a
                class="nav-item"
                routerLink="/panel"
                routerLinkActive="is-active"
                [routerLinkActiveOptions]="{ exact: true }"
                [attr.title]="collapsed() ? ('panel.nav.invitations' | transloco) : null"
              >
                <tk-icon name="layout-dashboard" />
                <span>{{ 'panel.nav.invitations' | transloco }}</span>
              </a>
              <button
                type="button"
                class="nav-item"
                [class.is-active]="pageTitle() === 'panel.nav.new'"
                (click)="openQuickCreate()"
                [attr.title]="collapsed() ? ('panel.nav.new' | transloco) : null"
              >
                <tk-icon name="plus" />
                <span>{{ 'panel.nav.new' | transloco }}</span>
                <kbd class="kbd nav-item__kbd">N</kbd>
              </button>
            </nav>

            <div class="sidebar__footer">
              @if (telegram(); as tg) {
                @if (tg.linked) {
                  <div class="tg-status" [attr.title]="'panel.shell.telegramLinked' | transloco">
                    <tk-icon name="circle-check" />
                    <span>{{ 'panel.shell.telegramLinked' | transloco }}</span>
                  </div>
                } @else if (tg.url) {
                  <div class="tg-card">
                    <strong><tk-icon name="send" /> {{ 'panel.shell.telegramTitle' | transloco }}</strong>
                    <p>{{ 'panel.shell.telegramHint' | transloco }}</p>
                    <a class="btn btn--sm btn--block" [href]="tg.url" target="_blank" rel="noopener">
                      {{ 'panel.nav.connectTelegram' | transloco }}
                    </a>
                  </div>
                }
              }

              <button type="button" class="user-btn" [cdkMenuTriggerFor]="userMenu" [cdkMenuPosition]="userMenuPosition">
                <span class="avatar">{{ me.email.charAt(0) }}</span>
                <span class="user-btn__text">
                  <strong>{{ 'panel.shell.account' | transloco }}</strong>
                  <span>{{ me.email }}</span>
                </span>
                <tk-icon name="chevrons-up-down" />
              </button>
            </div>
          </aside>

          <div class="backdrop" (click)="mobileOpen.set(false)" aria-hidden="true"></div>

          <div class="main">
            <header class="topbar">
              <button
                type="button"
                class="btn btn--icon"
                (click)="toggleSidebar()"
                [attr.aria-label]="'panel.shell.toggleSidebar' | transloco"
                [attr.title]="('panel.shell.toggleSidebar' | transloco) + ' (Ctrl+B)'"
              >
                <tk-icon class="only-desktop" name="panel-left" />
                <tk-icon class="only-mobile" name="menu" />
              </button>
              <span class="topbar__sep hide-sm"></span>
              <nav class="crumbs" [attr.aria-label]="'panel.shell.breadcrumb' | transloco">
                <a routerLink="/panel" class="hide-sm">{{ 'panel.shell.breadcrumbRoot' | transloco }}</a>
                @if (pageTitle(); as t) {
                  <tk-icon name="chevron-right" class="hide-sm" />
                  <strong>{{ t | transloco }}</strong>
                }
              </nav>

              <div class="topbar__right">
                <div class="lang-switch" role="group" [attr.aria-label]="'panel.shell.language' | transloco">
                  @for (l of locales; track l) {
                    <button type="button" [class.is-active]="i18n.lang() === l" [attr.aria-pressed]="i18n.lang() === l" (click)="setLang(l)">
                      {{ l.toUpperCase() }}
                    </button>
                  }
                </div>
                <button
                  type="button"
                  class="btn btn--icon"
                  (click)="theme.set(theme.isDark() ? 'light' : 'dark')"
                  [attr.aria-label]="'panel.shell.theme' | transloco"
                  [attr.title]="(theme.isDark() ? 'panel.shell.themeLight' : 'panel.shell.themeDark') | transloco"
                >
                  <tk-icon [name]="theme.isDark() ? 'sun' : 'moon'" />
                </button>
                @if (pageTitle() !== 'panel.nav.new' && pageTitle() !== 'panel.nav.invitations') {
                  <button type="button" class="btn btn--primary btn--sm hide-sm" (click)="openQuickCreate()">
                    <tk-icon name="plus" /> {{ 'panel.nav.new' | transloco }}
                  </button>
                }
              </div>
            </header>

            <main class="content">
              <router-outlet />
            </main>
          </div>
        </div>
      } @else {
        <router-outlet />
      }
      <tk-toast-outlet />
    </div>

    <ng-template #userMenu>
      <div class="menu" cdkMenu>
        @if (session.profile(); as me) {
          <div class="menu__header">
            <strong>{{ 'panel.shell.account' | transloco }}</strong>
            <span>{{ me.email }}</span>
          </div>
        }
        <div class="menu__sep"></div>
        <div class="menu__label">{{ 'panel.shell.theme' | transloco }}</div>
        <div cdkMenuGroup>
          @for (m of themes; track m.mode) {
            <button
              type="button"
              class="menu__item"
              cdkMenuItemRadio
              [cdkMenuItemChecked]="theme.mode() === m.mode"
              (cdkMenuItemTriggered)="theme.set(m.mode)"
            >
              <tk-icon [name]="m.icon" /> {{ m.label | transloco }}
            </button>
          }
        </div>
        <div class="menu__sep"></div>
        <button type="button" class="menu__item menu__item--danger" cdkMenuItem (cdkMenuItemTriggered)="logout()">
          <tk-icon name="log-out" /> {{ 'panel.nav.logout' | transloco }}
        </button>
      </div>
    </ng-template>
  `,
})
export class PanelShellComponent {
  protected readonly session = inject(OwnerSession);
  protected readonly theme = inject(PanelTheme);
  protected readonly i18n = inject(LangService);
  private readonly api = inject(OwnerApi);
  private readonly router = inject(Router);
  private readonly quick = inject(QuickCreate);
  private readonly title = inject(Title);

  protected readonly locales = LOCALES;
  protected readonly themes: { mode: ThemeMode; icon: 'sun' | 'moon' | 'monitor'; label: string }[] = [
    { mode: 'light', icon: 'sun', label: 'panel.shell.themeLight' },
    { mode: 'dark', icon: 'moon', label: 'panel.shell.themeDark' },
    { mode: 'system', icon: 'monitor', label: 'panel.shell.themeSystem' },
  ];
  // Menyu tugmaning tepasida ochiladi: tugma sidebar'ning eng pastida.
  protected readonly userMenuPosition: ConnectedPosition[] = [
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  protected readonly telegram = signal<TelegramLinkInfo | null>(null);
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly mobileOpen = signal(false);

  protected openQuickCreate(): void {
    this.mobileOpen.set(false);
    void this.quick.open();
  }

  private readonly navEnd = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => Date.now())));
  /** Sahifa sarlavhasi (i18n kaliti) marshrut data.title'dan. */
  protected readonly pageTitle = computed(() => {
    this.navEnd();
    let node = this.router.routerState.snapshot.root;
    let found: string | null = null;
    while (node) {
      found = (node.data['title'] as string | undefined) ?? found;
      node = node.firstChild!;
    }
    return found;
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => void this.restoreLang());
    effect(() => {
      const page = this.pageTitle();
      this.i18n.lang();
      const parts = [page ? this.i18n.translate(page) : null, this.i18n.translate('panel.title'), 'Taklifnoma'];
      this.title.setTitle(parts.filter(Boolean).join(' · '));
    });
    // Sahifa almashganda mobil menyu yopiladi.
    effect(() => {
      this.navEnd();
      this.mobileOpen.set(false);
    });
    // Kirgandan keyin owner Telegram holatini bir marta olamiz.
    effect(() => {
      if (this.session.profile() && !this.telegram()) {
        this.api.telegram().then((t) => this.telegram.set(t), () => undefined);
      }
    });
  }

  protected toggleSidebar(): void {
    if (matchMedia('(min-width: 1024px)').matches) {
      const next = !this.collapsed();
      this.collapsed.set(next);
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'open');
      } catch {
        /* saqlanmasa ham bo'ladi */
      }
    } else {
      this.mobileOpen.update((v) => !v);
    }
  }

  protected onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && this.session.profile()) {
      e.preventDefault();
      this.toggleSidebar();
    } else if (e.key === 'Escape' && this.mobileOpen()) {
      this.mobileOpen.set(false);
    } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && this.session.profile() && !isTyping(e.target)) {
      // "N": tezkor yaratish (matn kiritilayotganda yoki dialog ochiq bo'lsa ishlamaydi).
      if (this.quick.isOpen()) return;
      e.preventDefault();
      this.openQuickCreate();
    }
  }

  protected async setLang(next: Locale): Promise<void> {
    if (next === this.i18n.lang()) return;
    await this.i18n.use(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* saqlanmasa ham bo'ladi */
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  }

  private async restoreLang(): Promise<void> {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (isLocale(saved) && saved !== this.i18n.lang()) await this.i18n.use(saved);
    } catch {
      /* localStorage yo'q */
    }
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    this.telegram.set(null);
    await this.router.navigateByUrl('/panel/login');
  }
}
