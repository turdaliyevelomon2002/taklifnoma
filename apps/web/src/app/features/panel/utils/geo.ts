import type { GeoPoint } from '@taklifnoma/shared';

/**
 * Owner xaritadan nusxa olgan narsani koordinataga aylantiradi:
 *  - "41.311081, 69.240562" (Google/Yandex'dan nusxa)
 *  - Yandex havolasi: ...?ll=69.240562%2C41.311081...  yoki  ...?pt=69.24,41.31...  (avval uzunlik!)
 *  - Google havolasi: .../@41.311081,69.240562,17z
 */
export function parseLocation(input: string): GeoPoint | null {
  const text = decodeURIComponent(input.trim());
  if (!text) return null;

  const yandex = /[?&](?:pt|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(text);
  if (yandex) return valid(Number(yandex[2]), Number(yandex[1]));

  const google = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(text);
  if (google) return valid(Number(google[1]), Number(google[2]));

  const plain = /^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/.exec(text);
  if (plain) return valid(Number(plain[1]), Number(plain[2]));

  return null;
}

/** Yandex tashkilot havolasidan ID: .../org/name/1234567890/ */
export function parseYandexOrgId(input: string): string | null {
  return /\/org\/(?:[^/]+\/)?(\d{5,20})/.exec(input)?.[1] ?? null;
}

function valid(lat: number, lng: number): GeoPoint | null {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
