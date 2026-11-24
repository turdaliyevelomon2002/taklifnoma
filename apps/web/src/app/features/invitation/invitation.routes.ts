import { Routes } from '@angular/router';
import { InvitationPage } from './invitation.page';
import { invitationResolver } from './invitation.resolver';

export const INVITATION_ROUTES: Routes = [
  {
    path: '',
    component: InvitationPage,
    resolve: { result: invitationResolver },
  },
  {
    // Juftlik paneli: shablon kodi va SSR kerak emas, alohida chunk.
    path: 'admin',
    loadComponent: () =>
      import('../couple-admin/couple-admin.page').then((m) => m.CoupleAdminPage),
  },
];
