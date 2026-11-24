import type { GuestListQuery, GuestPage, GuestView, Locale } from '@taklifnoma/shared';

/**
 * Mehmonlar ro'yxati uchun ma'lumot manbai. Juftlik paneli (CoupleApi) va owner paneli
 * (OwnerApi.guestSource(id)) bir xil GuestListComponent'dan foydalanadi.
 */
export interface GuestSource {
  listGuests(query: GuestListQuery): Promise<GuestPage>;
  setWishHidden(id: string, hidden: boolean): Promise<GuestView>;
  removeGuest(id: string): Promise<void>;
  exportExcel(lang: Locale): Promise<{ blob: Blob; fileName: string }>;
}
