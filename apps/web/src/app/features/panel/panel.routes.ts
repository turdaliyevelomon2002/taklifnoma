import { Routes } from '@angular/router';
import { PanelDashboardPage } from './dashboard.page';
import { PanelLoginPage } from './login.page';
import { unsavedChangesGuard } from './editor/unsaved-changes.guard';
import { ownerGuard } from './owner-session.service';
import { PanelShellComponent } from './panel-shell.component';

/**
 * /panel: owner paneli. Butun bo'lim alohida lazy chunk, faqat brauzerda render qilinadi.
 * Forma (Zod bilan) yana alohida chunk: ro'yxatni ochish uchun uni yuklash shart emas.
 */
export const PANEL_ROUTES: Routes = [
  {
    // Ko'rib chiqish: menyusiz, xuddi mehmon ko'radigandek.
    path: 'i/:id/preview',
    canActivate: [ownerGuard],
    loadComponent: () => import('./preview/preview.page').then((m) => m.PanelPreviewPage),
  },
  {
    path: '',
    component: PanelShellComponent,
    children: [
      { path: 'login', component: PanelLoginPage },
      {
        path: '',
        canActivate: [ownerGuard],
        children: [
          // data.title: topbar va brauzer sarlavhasi uchun i18n kaliti.
          { path: '', component: PanelDashboardPage, data: { title: 'panel.nav.invitations' } },
          {
            path: 'new',
            loadComponent: () => import('./new.page').then((m) => m.PanelNewPage),
            canDeactivate: [unsavedChangesGuard],
            data: { title: 'panel.nav.new' },
          },
          {
            path: 'i/:id',
            loadComponent: () => import('./detail.page').then((m) => m.PanelDetailPage),
            canDeactivate: [unsavedChangesGuard],
            data: { title: 'panel.shell.invitation' },
          },
        ],
      },
    ],
  },
];
