import type { InvitationStatus } from '../enums';
import type { InvitationListItem } from './invitations';

/** Owner paneli bosh sahifasi. */
export interface OwnerDashboard {
  counts: Record<InvitationStatus, number> & { total: number };
  /** Yaqin kunlardagi faol to'ylar (eng yaqini birinchi). */
  upcoming: InvitationListItem[];
  /** So'mda; to'langan (paidAt bor) buyurtmalar bo'yicha. */
  revenue: { thisMonth: number; total: number };
  /** Narxi belgilangan, lekin hali to'lanmagan, arxivlanmagan buyurtmalar. */
  unpaid: number;
}

export const DASHBOARD_UPCOMING_DAYS = 14;
