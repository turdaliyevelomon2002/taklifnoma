import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Bosh sahifa build vaqtida statik HTML qilib tayyorlanadi.
  { path: '', renderMode: RenderMode.Prerender },
  // Owner paneli: faqat brauzerda.
  { path: 'panel', renderMode: RenderMode.Client },
  { path: 'panel/**', renderMode: RenderMode.Client },
  // Mini App kirishi: initData URL fragmentida, server uni ko'rmaydi.
  { path: 'tg', renderMode: RenderMode.Client },
  // Juftlik paneli: shaxsiy ma'lumot, SEO kerak emas -> faqat brauzerda render.
  { path: ':slug/admin', renderMode: RenderMode.Client },
  // Taklifnomalar har so'rovda serverda render qilinadi (OG meta + tez birinchi ochilish).
  { path: '**', renderMode: RenderMode.Server },
];
