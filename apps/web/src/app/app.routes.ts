import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  // Owner paneli. "panel" slug sifatida band qilingan (RESERVED_SLUGS), :slug'dan oldin turishi shart.
  {
    path: 'panel',
    loadChildren: () => import('./features/panel/panel.routes').then((m) => m.PANEL_ROUTES),
  },
  {
    path: ':slug',
    loadChildren: () =>
      import('./features/invitation/invitation.routes').then((m) => m.INVITATION_ROUTES),
  },
  {
    path: '**',
    loadComponent: () => import('./features/status/not-found.page').then((m) => m.NotFoundPage),
  },
];
