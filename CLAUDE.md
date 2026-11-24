# Taklifnoma: loyiha konteksti (Claude Code uchun)

Uzbek onlayn to'y taklifnomalari SaaS: `domen.uz/{slug}`. Har bir taklifnoma = shablon + JSON config.
Foydalanuvchi bilan **o'zbek tilida** muloqot qilinadi.

## Holat
1–6 bosqichlar tugagan: API+DB, 3 ta shablon, RSVP+Telegram, juftlik paneli, owner paneli, Docker/deploy.
Docker image'lar hali haqiqiy Docker'da build qilinmagan (ishlab chiqish kompyuterida Docker Engine ishlamagan):
birinchi `docker compose up -d --build` da xato chiqsa, shu yerdan boshlang.

## Stack
- npm workspaces: `packages/shared` (Zod sxemalar, tiplar, enumlar; CJS+ESM), `apps/api` (NestJS 11 + Prisma 6 + PostgreSQL), `apps/web` (Angular 22 standalone, signals, zoneless, SSR, Transloco).
- Fayllar: S3/MinIO (sharp bilan webp variantlar). Telegram Bot API (polling dev / webhook prod, outbox dispatcher).
- Production: `docker-compose.yml` (Caddy HTTPS → web/api, PostgreSQL, MinIO). Batafsil: README.

## Qoidalar (foydalanuvchi talab qilgan)
- Ish bosqichma-bosqich; har bosqichdan keyin to'xtab, o'zbekcha qisqa ishga tushirish/tekshirish yo'riqnomasi beriladi.
- **UI matnlari faqat i18n fayllarda** (`apps/web/src/i18n/{uz,ru}.json`, API: `apps/api/src/i18n`). Hardcode yo'q; yangi kalit ikkala tilga qo'shiladi.
- Xavfsizlik: RSVP rate limit (5/min + 10/kun IP xesh), honeypot, HMAC forma tokeni, Zod validatsiya, link-spam filtri. Owner/couple JWT httpOnly cookie'da.
- Commit/push faqat foydalanuvchi so'raganda.

## Muhim texnik kelishuvlar
- Web'da runtime qiymatlar faqat `@taklifnoma/shared/enums` va `/phone` subpath'laridan import qilinadi (Zod asosiy bundle'ga tushmasin). Root import faqat lazy chunk'larda (owner panel formasi).
- API xatolari: `{statusCode, code, issues?, details?}`; web'da `core/api/api-error.ts` (`errorKey`, TRANSLATED ro'yxati) — yangi xato kodi qo'shilsa u yerga va `errors.*` i18n'ga ham qo'shing.
- Shablonlar: `features/invitation/templates/<kalit>/`, `InvitationTemplateBase` dan meros, `registry.ts` da ro'yxatdan o'tadi. Ranglar `--tk-*` CSS o'zgaruvchilari.
- Panellar (`/panel/**`, `/:slug/admin`) `RenderMode.Client`, `X-Robots-Tag: noindex`.
- Vaqtlar taklifnomaning `config.timezone` ida (default `Asia/Tashkent`).
- Root `package.json` dagi `allowScripts`: Prisma skriptlariga ruxsat, qolganlari prebuilt binar bilan ishlaydi.

## Buyruqlar
```bash
npm install
npm run dev:infra && npm run db:migrate && npm run db:seed
npm run dev:api        # :3000
npm run dev:web        # :4200
npm test               # shared build + jest
```
