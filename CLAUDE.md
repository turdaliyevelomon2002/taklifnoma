# Taklifnoma: loyiha konteksti (Claude Code uchun)

Uzbek onlayn to'y taklifnomalari SaaS: `domen.uz/{slug}`. Har bir taklifnoma = shablon + JSON config.
Foydalanuvchi bilan **o'zbek tilida** muloqot qilinadi.

## Holat
1–6 bosqichlar tugagan: API+DB, 3 ta shablon, RSVP+Telegram, juftlik paneli, owner paneli, Docker/deploy.
Lokal Docker infra (PostgreSQL :5434, SeaweedFS :8333) bilan to'liq sinalgan. Production image'lari (`docker compose up -d --build`) hali build qilinmagan: xato chiqsa, shu yerdan boshlang.

## Stack
- npm workspaces: `packages/shared` (Zod sxemalar, tiplar, enumlar; CJS+ESM), `apps/api` (NestJS 11 + Prisma 6 + PostgreSQL), `apps/web` (Angular 22 standalone, signals, zoneless, SSR, Transloco).
- Fayllar: S3 API, lokal va prod'da SeaweedFS (MinIO image'lari endi ochiq emas); bucket'ni API o'zi yaratadi; sharp bilan webp variantlar. Telegram Bot API (polling dev / webhook prod, outbox dispatcher).
- Production: `docker-compose.yml` (Caddy HTTPS → web/api, PostgreSQL, SeaweedFS). Batafsil: README.
- Bepul deploy: `render.yaml` (Render free, web+api **bitta** servisda: `deploy/render-start.mjs`, SSR `API_PROXY_TARGET` bilan `/api` ni proksi qiladi) + Neon + Supabase Storage. Yo'riqnoma: `docs/DEPLOY-FREE.md`.

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
- Owner panel UI: shadcn uslubidagi tokenlar `html.tk-panel` (+`.dark`) da (`features/panel/panel.scss`, ViewEncapsulation.None), primitivlar `features/panel/ui/` (ikonkalar, toast, `PanelConfirm`, tema). Dialog/menyu: `@angular/cdk`. Brauzer `confirm()` ishlatilmaydi.
- Qoralama: `invitationDraftConfigSchema` (to'yxona nomi/manzil/lokatsiya ixtiyoriy) yaratish/tahrirlashda; chop etishda (ACTIVE) va faol taklifnomani saqlashda to'liq sxema, xato `INVITATION_INCOMPLETE` (issues `config.*`). Shablonlar to'yxonasiz config'ni ko'tarishi shart.
- Muharrirdagi jonli preview: iframe `/panel/i/:id/preview?embed=1`, saqlanmagan config `postMessage` bilan (`panel/preview/preview-protocol.ts`, faqat shu origin). Saqlanmagan o'zgarishlar: `unsavedChangesGuard` + tab almashishda `confirmDiscard`.
- Tilaklar: alohida `Wish` jadvali (muallif = `rsvpId`, bir mehmon bir nechta tilak, chegara `RSVP_LIMITS.wishesPerGuest`); keyingi tilak `POST public/.../wishes` (Telegram initData yoki RSVP bergan `guestToken`). Holat PENDING/APPROVED/HIDDEN (`config.rsvp.moderateWishes`), so'kinish filtri `apps/api/src/rsvp/profanity.ts` (rad etmaydi, belgilaydi). Telegram tugmalari `w:a|h:<rsvpId>` callback.
- Mehmon identifikatsiyasi: Telegram Mini App (`/tg` -> `/:slug`, initData URL fragmentidan `TelegramWebAppService`), serverda `telegram/init-data.ts` imzoni tekshiradi; `config.rsvp.telegramOnly`, env `TELEGRAM_MINIAPP_NAME`.
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
