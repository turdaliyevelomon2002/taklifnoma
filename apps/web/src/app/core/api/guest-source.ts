import type { GuestListQuery, GuestPage, GuestView, Locale, WishStatusInput } from '@taklifnoma/shared';

/**
 * Mehmonlar ro'yxati uchun ma'lumot manbai. Juftlik paneli (CoupleApi) va owner paneli
 * (OwnerApi.guestSource(id)) bir xil GuestListComponent'dan foydalanadi.
 */
export interface GuestSource {
  listGuests(query: GuestListQuery): Promise<GuestPage>;
  /** id: tilak ID'si. Muallif (mehmon) kartasi qaytadi. */
  setWishStatus(id: string, status: WishStatusInput['status']): Promise<GuestView>;
  removeGuest(id: string): Promise<void>;
  exportExcel(lang: Locale): Promise<{ blob: Blob; fileName: string }>;
}
