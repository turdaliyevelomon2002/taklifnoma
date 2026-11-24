import type { Venue } from '@taklifnoma/shared';

/** Koordinatalar backend'da Zod bilan tekshirilgan; bu yerda ham faqat raqam sifatida ishlatiladi. */
function coords(venue: Venue): { lat: string; lng: string } {
  return { lat: Number(venue.location.lat).toFixed(6), lng: Number(venue.location.lng).toFixed(6) };
}

/** Sahifaga joylanadigan Yandex xarita vidjeti (API kalit talab qilmaydi). */
export function yandexWidgetUrl(venue: Venue): string {
  if (venue.yandexOrgId) {
    return `https://yandex.uz/map-widget/v1/?oid=${encodeURIComponent(venue.yandexOrgId)}&z=16`;
  }
  const { lat, lng } = coords(venue);
  return `https://yandex.uz/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm`;
}

/** "Yo'nalish": joriy joylashuvdan to'yxonagacha marshrut. Telefonda Yandex Maps ilovasi ochiladi. */
export function yandexDirectionsUrl(venue: Venue): string {
  const { lat, lng } = coords(venue);
  return `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
}

export function yandexPlaceUrl(venue: Venue): string {
  if (venue.yandexOrgId) {
    return `https://yandex.uz/maps/org/${encodeURIComponent(venue.yandexOrgId)}/`;
  }
  const { lat, lng } = coords(venue);
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;
}
