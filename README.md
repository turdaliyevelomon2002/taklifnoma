# Taklifnoma: onlayn to'y taklifnomasi SaaS

Har bir juftlik uchun `domen.uz/{slug}` manzilida taklifnoma sayti. Saytlar shablon va JSON config asosida generatsiya qilinadi.

## Tuzilma

```
apps/api          NestJS + Prisma (PostgreSQL), S3 (MinIO)
apps/web          Angular 22 SSR: mehmon sahifasi, shablonlar, i18n (Transloco)
packages/shared   Umumiy tiplar va Zod sxemalari: InvitationConfig, FeatureFlags, API kontraktlari
```

## Lokal ishga tushirish

Talablar: Node.js 24.15+ (`.nvmrc`), Docker Desktop.

```bash
npm install
cp apps/api/.env.example apps/api/.env      # kerak bo'lsa qiymatlarni o'zgartiring
npm run dev:infra                           # PostgreSQL :5433, MinIO :9000 (konsol :9001)
npm run db:migrate                          # migratsiyalarni qo'llaydi
npm run db:seed                             # owner akkaunti + demo "ali-madina"
npm run dev:api                             # http://localhost:3000/api
npm run dev:web                             # http://localhost:4200 (SSR, /api -> :3000 proksi)
```

Testlar: `npm test`

## API (1-bosqich)

Barcha xatolar bir xil formatda qaytadi: `{ statusCode, code, issues?, details? }`.
`code` qiymati frontend'da i18n kalitiga aylantiriladi (`errors.<CODE>`).

| Metod | Yo'l | Kirish | Tavsif |
|---|---|---|---|
| GET | `/api/health` | — | DB va storage holati |
| GET | `/api/public/invitations/:slug` | — | Mehmon sahifasi ma'lumoti (faqat ACTIVE) |
| POST | `/api/owner/auth/login` | — | `{ email, password }`, javobda httpOnly cookie |
| POST | `/api/owner/auth/logout` | — | |
| GET | `/api/owner/auth/me` | owner | |
| GET | `/api/owner/invitations` | owner | `?status&package&q&sort&order&page&limit` |
| GET | `/api/owner/invitations/slug-check?slug=` | owner | Slug bo'shligini tekshirish |
| POST | `/api/owner/invitations` | owner | Yaratish: javobda `access.adminUrl` va `access.pin` (bir marta ko'rsatiladi) |
| GET | `/api/owner/invitations/:id` | owner | To'liq ma'lumot + statistika + media |
| GET | `/api/owner/invitations/:id/preview` | owner | Qoralamani mehmon ko'rinishida ko'rish |
| PATCH | `/api/owner/invitations/:id` | owner | Qisman yangilash |
| POST | `/api/owner/invitations/:id/status` | owner | `{ status: DRAFT \| ACTIVE \| ARCHIVED }` |
| POST | `/api/owner/invitations/:id/access/regenerate` | owner | Yangi havola va PIN, eski sessiyalar bekor bo'ladi |
| DELETE | `/api/owner/invitations/:id` | owner | Fayllari bilan birga o'chiradi |
| POST | `/api/owner/invitations/:id/media/:kind` | owner | `kind`: `cover \| gallery \| music \| og-image`, multipart maydoni `file` |
| PATCH | `/api/owner/invitations/:id/media/gallery/order` | owner | `{ ids: [...] }` |
| DELETE | `/api/owner/invitations/:id/media/:mediaId` | owner | |
| POST | `/api/couple/auth/token` | — | `{ slug, token }`: maxfiy havola orqali kirish |
| POST | `/api/couple/auth/pin` | — | `{ slug, pin }`: 5 marta xato bo'lsa 15 daqiqa blok |
| GET | `/api/couple/me` | couple | |

## Paketlar

| | Oddiy | Standart | Premium |
|---|---|---|---|
| Hisoblagich, xarita, RSVP, bir nechta tadbir | ✔ | ✔ | ✔ |
| Musiqa | — | ✔ | ✔ |
| Galereya | — | 12 ta rasm | 30 ta rasm |
| Tilaklar devori, rus tili, Excel, Telegram | — | ✔ | ✔ |

Owner istalgan taklifnoma uchun `featureOverrides` orqali istisno belgilashi mumkin.
Qoidalar `packages/shared/src/features.ts` faylida.

## Shablon tizimi (2-bosqich)

```
apps/web/src/app/features/invitation/
  invitation.resolver.ts   ma'lumot + til + shablon chunk + SEO, hammasi render'dan oldin tayyorlanadi
  invitation.page.ts       shablonni NgComponentOutlet orqali dinamik render qiladi
  templates/
    template-base.ts       barcha shablonlar uchun umumiy kontrakt (input: PublicInvitation)
    registry.ts            templateKey -> lazy komponent, shriftlar, theme-color
    classic-gold/          "Klassik oltin"
  sections/                umumiy bloklar: countdown, event-card, venue-map, gallery, music, lang-switch
apps/web/src/i18n/         uz.json, ru.json: interfeysning barcha matnlari
```

**Yangi shablon qo'shish:**
1. `templates/<nom>/` papkasida `InvitationTemplateBase` dan meros olgan komponent yarating.
2. Uni `registry.ts` ga qo'shing.

Section'lar dizaynni CSS o'zgaruvchilari orqali oladi (`--tk-primary`, `--tk-surface`, `--tk-font-heading` va boshqalar).

**Ishlash tamoyillari:**
- Mehmon sahifasi SSR'da to'liq render qilinadi.
- OG va Twitter meta HTML ichida bo'ladi: Telegram preview shulardan olinadi.
- Sahifalar `noindex`: shaxsiy taklifnomalar qidiruv tizimlariga tushmaydi.
- SSR ma'lumoti brauzerga `TransferState` orqali uzatiladi, shuning uchun hydration paytida API'ga qayta so'rov ketmaydi.
- Til `?lang=ru` orqali tanlanadi, matnlar `src/i18n/*.json` da.
- Musiqa faqat foydalanuvchi bosganda yoqiladi ("Taklifnomani ochish" tugmasi). Sababi: brauzerlar ovozli autoplay'ni bloklaydi.
- Xarita (Yandex iframe) `@defer (on viewport)` bilan faqat ko'rinish maydoniga kelganda yuklanadi.

## RSVP va Telegram (3-bosqich)

### RSVP endpointlari

| Metod | Yo'l | Izoh |
|---|---|---|
| GET | `/api/public/invitations/:slug/rsvp-token` | Imzolangan forma tokeni (`no-store`) |
| POST | `/api/public/invitations/:slug/rsvp` | Javob yuborish; shu telefon bilan qayta yuborilsa javob yangilanadi |
| GET | `/api/public/invitations/:slug/wishes` | Tilaklar devori (faqat `wishesWall` yoqilgan bo'lsa) |
| GET | `/api/owner/telegram` | Owner uchun botni ulash havolasi |
| POST | `/api/telegram/webhook` | Telegram webhook (faqat `webhook` rejimida) |

Spamdan himoya qatlamlari (tartib bilan):
1. IP bo'yicha rate limit: 5 ta yuborish/daqiqa (`@nestjs/throttler`).
2. Zod validatsiya (frontend bilan bir xil sxema).
3. Honeypot maydoni (`website`): botga soxta "muvaffaqiyat" qaytariladi, hech narsa saqlanmaydi.
4. HMAC bilan imzolangan forma tokeni: 3 soniyadan tez yuborilsa rad etiladi, 12 soatdan keyin eskiradi, faqat o'z taklifnomasida ishlaydi.
5. Config qoidalari: muddat, mehmonlar soni, telefon majburiyligi; ism yoki tilakda havola bo'lsa rad etiladi.
6. Bitta IP'dan bitta taklifnomaga kuniga ko'pi bilan 10 ta javob (IP xom holda saqlanmaydi, faqat HMAC xeshi).

### Telegram botni sozlash

1. [@BotFather](https://t.me/BotFather) → `/newbot` → tokenni `apps/api/.env` ga yozing: `TELEGRAM_BOT_TOKEN=...`
2. **Lokal (polling):** boshqa hech narsa kerak emas, API ishga tushganda bot xabarlarni o'zi tortib oladi.
3. **Production (webhook):**
   ```env
   TELEGRAM_MODE=webhook
   TELEGRAM_WEBHOOK_URL=https://domen.uz/api/telegram/webhook
   TELEGRAM_WEBHOOK_SECRET=<32+ belgi, A-Z a-z 0-9 _ ->
   ```
   API ishga tushganda `setWebhook` ni o'zi chaqiradi. Telegram har so'rovda maxfiy sarlavha yuboradi va API uni tekshiradi.
4. **Ulash:**
   - Owner: `GET /api/owner/telegram` → `https://t.me/<bot>?start=o_...` havolasini oching va **Start** bosing.
   - Juftlik: taklifnoma ma'lumotlaridagi `telegramLinkUrl` (`?start=c_...`) havolasini juftlikka yuboring. Bu faqat `telegramNotify` yoqilgan paketlarda (Standart, Premium) ishlaydi.
   - Xabarlarni to'xtatish: botga `/stop`.

Xabarlar outbox jadvali (`Notification`) orqali yuboriladi: RSVP saqlangan tranzaksiyaning o'zida yoziladi, keyin alohida yuboriladi. Telegram vaqtincha ishlamasa, qayta urinish vaqti 30s → 2m → 10m → 30m → 2h (ko'pi bilan 6 marta). Bot bloklangan bo'lsa, qayta urinilmaydi.

## Juftlik paneli (4-bosqich)

Manzil: `domen.uz/{slug}/admin`. Bu sahifa faqat brauzerda render qilinadi: server mehmonlar ma'lumotini HTML'ga qo'shmaydi, sahifa `noindex`.

**Kirish:**
- **Maxfiy havola:** `/{slug}/admin#k=<token>`. Token URL fragmentida (`#`), shuning uchun serverga va loglarga tushmaydi. Kirilgandan keyin manzildan darhol o'chiriladi.
- **PIN:** 6 xonali kod. 5 marta noto'g'ri kiritilsa, 15 daqiqaga bloklanadi.
- Sessiya httpOnly cookie'da (`tk_couple`). Owner kirish ma'lumotlarini yangilasa, eski sessiyalar bekor bo'ladi.

**Imkoniyatlar:**
- Statistika: keladigan mehmonlar soni, jami javoblar, keladi / kelmaydi.
- Telegram'ni ulash tugmasi (Standart va Premium paketlarda).
- Mehmonlar ro'yxati:
  - filtr: hammasi / keladi / kelmaydi;
  - qidiruv: ism, telefon raqami yoki tilak matni bo'yicha;
  - saralash va sahifalash.
- Tilakni ommaviy "Tilaklar" devoridan yashirish yoki qaytarish.
- Spam yoki takroriy javobni o'chirish (ikki bosqichli tasdiq bilan).
- Excel eksport (Standart va Premium paketlarda):
  - 2 ta varaq: "Mehmonlar" va "Statistika";
  - ustun sarlavhalari panel tilida (uz yoki ru);
  - sanalar taklifnoma vaqt zonasida.

| Metod | Yo'l | Izoh |
|---|---|---|
| POST | `/api/couple/auth/token` · `/pin` · `/logout` | Kirish va chiqish |
| GET | `/api/couple/me` | Sessiya, statistika, paket imkoniyatlari |
| GET | `/api/couple/guests?filter=&q=&sort=&page=&pageSize=` | Mehmonlar ro'yxati |
| PATCH | `/api/couple/guests/:id/wish` | `{ hidden: boolean }` |
| DELETE | `/api/couple/guests/:id` | Javobni o'chirish |
| GET | `/api/couple/guests/export?lang=uz` | `.xlsx` fayl |

Har bir so'rov faqat sessiyadagi taklifnoma doirasida ishlaydi: boshqa taklifnomaning javobiga ID orqali kirib bo'lmaydi (404 qaytadi). Excel'da mehmon yozgan `=`, `+`, `-`, `@` bilan boshlanadigan matnlar formula sifatida emas, oddiy matn sifatida yoziladi (formula injection himoyasi).

## Owner paneli (5-bosqich)

`/panel` (faqat brauzerda render, `X-Robots-Tag: noindex`, `no-store`). Kirish: `.env` dagi `OWNER_EMAIL` / `OWNER_PASSWORD`.

| Sahifa | Nima qiladi |
| --- | --- |
| `/panel` | Ko'rsatkichlar (faol, qoralama, shu oy tushum, to'lanmagan), yaqin 14 kundagi to'ylar, buyurtmalar ro'yxati: qidiruv, holat, paket, saralash, sahifalash |
| `/panel/new` | Yangi taklifnoma: buyurtma, paket, shablon, juftlik, tadbirlar, matnlar (uz/ru), RSVP, ranglar, SEO, imkoniyatlarni paketdan tashqari yoqish/o'chirish. Slug ismlardan avtomatik va bandligi tekshiriladi. Yaratilgach havola va PIN **bir marta** ko'rsatiladi |
| `/panel/i/:id` | Tablar: Ma'lumotlar (tahrirlash, to'langan sana), Rasm va musiqa (muqova, galereya: limit paketga qarab, tartib, o'chirish, musiqa, OG rasm), Mehmonlar (ro'yxat, tilakni yashirish, Excel har doim), Kirish (yangi havola+PIN, Telegram ulash havolasi, o'chirish slug'ni yozib tasdiqlanadi) |
| `/panel/i/:id/preview` | Qoralamani mehmon ko'rinishida ko'rish |

Holatlar: `DRAFT` (mehmonlarga 404) → `ACTIVE` → `ARCHIVED`.

Yangi API endpointlari: `GET /api/owner/dashboard`, `GET|PATCH|DELETE /api/owner/invitations/:id/guests…`, `GET /api/owner/invitations/:id/guests/export?lang=uz|ru`.

Koordinatalar maydoni Yandex (`ll=`/`pt=`), Google (`@lat,lng`) havolalarini yoki `41.31, 69.24` ni tushunadi. Vaqtlar taklifnomaning vaqt mintaqasida kiritiladi.

## Shablonlar (6-bosqich)

| Kalit | Nomi | Uslub |
| --- | --- | --- |
| `classic-gold` | Klassik oltin | Fil suyagi fon, oltin ramka, kalligrafik ismlar, ravoq shaklidagi rasm |
| `minimal-white` | Minimal oq | Oq fon, to'liq ekranli rasm, ingichka chiziqlar, Playfair + Montserrat |
| `national-pattern` | Milliy naqsh | Lojuvard fon, sakkiz qirrali yulduzli girih naqshi (CSS/SVG), mehrob ravoq, oltin hoshiya |

Har bir shablon alohida lazy chunk (~4 KB gzip). Yangi shablon qo'shish:
1. `apps/web/src/app/features/invitation/templates/<kalit>/` ichida `InvitationTemplateBase` dan meros oluvchi komponent yarating (bo'limlar `sections/` dan qayta ishlatiladi).
2. `templates/registry.ts` ga shriftlar, `themeColor` va `load()` ni qo'shing.
3. `packages/shared/src/enums.ts` dagi `TEMPLATE_KEYS` ga kalitni va i18n'ga `panel.templates.<kalit>` matnini qo'shing.

Ranglar CSS o'zgaruvchilari orqali (`--tk-primary`, `--tk-accent`, `--tk-bg`, `--tk-surface`, `--tk-field-bg`, ...): owner panelida taklifnoma uchun asosiy/qo'shimcha rangni almashtirish mumkin.

## Production (Docker)

```
Internet ──► Caddy :443 (HTTPS, Let's Encrypt)
               ├─ /api/*    ──► api  (NestJS, :3000) ──► postgres, minio
               ├─ /media/*  ──► minio (faqat GET, uzoq kesh)
               └─ qolgani   ──► web  (Angular SSR, :4000) ──► api (ichki tarmoq)
```

Faqat 80/443 portlar ochiq; PostgreSQL va MinIO tashqariga chiqmaydi. API konteyneri har ishga tushganda `prisma migrate deploy` bajaradi (`RUN_MIGRATIONS=false` bilan o'chiriladi).

### Server'ga deploy (Ubuntu 22.04/24.04, 2 GB RAM yetarli)

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Kod va sozlamalar
git clone <repo> taklifnoma && cd taklifnoma
cp .env.production.example .env
nano .env        # DOMAIN, parollar, maxfiy kalitlar (openssl rand -base64 48)

# 3. DNS: domen.uz va www.domen.uz A yozuvi -> server IP

# 4. Ishga tushirish
docker compose up -d --build
docker compose ps                                     # hammasi healthy bo'lishi kerak
docker compose run --rm api node dist-seed/seed.js    # owner akkaunti (.env dagi OWNER_EMAIL/PASSWORD)

# 5. Tekshirish
curl https://domen.uz/api/health                      # {"status":"ok","db":"ok","storage":"ok"}
# Brauzerda: https://domen.uz/panel
```

Telegram: `.env` ga `TELEGRAM_BOT_TOKEN` va `TELEGRAM_WEBHOOK_SECRET` yozib `docker compose up -d api` qiling: webhook avtomatik o'rnatiladi.

### Yangilash

```bash
git pull
docker compose up -d --build      # migratsiyalar avtomatik qo'llanadi
docker image prune -f
```

### Zaxira nusxa (backup)

```bash
# Baza
docker compose exec -T postgres pg_dump -U taklifnoma -Fc taklifnoma > backup-$(date +%F).dump
# Tiklash
docker compose exec -T postgres pg_restore -U taklifnoma -d taklifnoma --clean < backup-YYYY-MM-DD.dump
# Fayllar (MinIO volume)
docker run --rm -v taklifnoma_minio-data:/data -v "$PWD":/backup alpine tar czf /backup/media-$(date +%F).tgz -C /data .
```

Kunlik zaxira uchun cron: `0 3 * * * cd /root/taklifnoma && docker compose exec -T postgres pg_dump -U taklifnoma -Fc taklifnoma > /root/backups/db-$(date +\%F).dump`

### Loglar

```bash
docker compose logs -f api web caddy
```
