# Bepul deploy: Render + Neon + Supabase

Karta talab qilinmaydi. Natija: `https://<servis>.onrender.com` (keyin o'z domeningizni ulash mumkin).

| Qism | Xizmat | Bepul limit |
|---|---|---|
| Web (Angular SSR) + API (NestJS) | Render, **bitta** web servis | 750 soat/oy, 512 MB RAM; 15 daqiqa so'rov bo'lmasa uxlaydi |
| PostgreSQL | Neon | 0.5 GB |
| Fayllar (rasm, musiqa) | Supabase Storage (S3) | 1 GB, fayl ≤ 50 MB |

Nega bitta servis: SSR server `/api/*` ni ichkarida API'ga uzatadi (`API_PROXY_TARGET`). Shunda brauzer uchun
hammasi bitta domen bo'ladi (httpOnly cookie va nisbiy `/api` o'zgarishsiz ishlaydi), 750 soatlik limit ham bitta servisga yetadi.
Ishga tushirishni `deploy/render-start.mjs` boshqaradi: migratsiya, owner seed, API (:3000), web ($PORT).

---

## 1. Neon (PostgreSQL)

1. https://neon.tech → GitHub bilan kiring → **New project** (region: *AWS Europe Central (Frankfurt)*).
2. **Connect** → *Connection pooling* belgisini **o'chiring** (to'g'ridan-to'g'ri ulanish; Prisma migratsiyasi uchun kerak).
3. Connection string'ni nusxalang:
   `postgresql://user:parol@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   Bu `DATABASE_URL` bo'ladi.

## 2. Supabase Storage (fayllar)

1. https://supabase.com → **New project** (region: Frankfurt). DB parolini saqlab qo'ying (ishlatmaymiz, lekin so'raladi).
2. **Storage → New bucket**: nomi `taklifnoma`, **Public bucket: ON**. Fayl hajmi limitini 25 MB qo'ying.
3. **Project Settings → Storage → S3 Connection**:
   - *Endpoint* → `S3_ENDPOINT` (masalan `https://<ref>.storage.supabase.co/storage/v1/s3`)
   - *Region* → `S3_REGION` (masalan `eu-central-1`)
   - **New access key** → `S3_ACCESS_KEY` va `S3_SECRET_KEY` (secret bir marta ko'rsatiladi).
4. `S3_PUBLIC_URL` = `https://<ref>.supabase.co/storage/v1/object/public/taklifnoma`
   (`<ref>`: loyiha URL'idagi identifikator).

## 3. GitHub

Render kodni GitHub'dan oladi. O'zgarishlarni `main` ga push qiling.
**Diqqat:** `apps/api/.env` git'da kuzatiladi. Unga haqiqiy token/parol yozilgan bo'lsa, commit qilmang
(`git restore apps/api/.env`); shaxsiy qiymatlar uchun `apps/api/.env.local` dan foydalaning (u git'ga tushmaydi).

## 4. Render

1. https://render.com → GitHub bilan kiring.
2. **New → Blueprint** → `taklifnoma` reposini tanlang. Render `render.yaml` ni o'qiydi.
3. So'ralgan qiymatlarni kiriting:

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | Owner paneliga kirish (kuchli parol) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` | Supabase'dan (2-qadam) |
| `TELEGRAM_BOT_TOKEN` | ixtiyoriy, bo'sh qoldirsa bot o'chiq |
| `TELEGRAM_WEBHOOK_SECRET` | bot bo'lsa: 32+ belgi, faqat `A-Z a-z 0-9 _ -`. Generatsiya: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TELEGRAM_MINIAPP_NAME` | ixtiyoriy (BotFather `/newapp`, URL: `https://<servis>.onrender.com/tg`) |

JWT/RSVP sirlarini Render o'zi generatsiya qiladi. `PUBLIC_WEB_URL`, `CORS_ORIGINS`, `TELEGRAM_WEBHOOK_URL`
avtomatik servis manzilidan olinadi.

4. **Apply**. Birinchi build ~5–8 daqiqa. Loglarda `[start] tayyor: web :10000 -> api ...` chiqishi kerak.

## 5. Tekshirish

- `https://<servis>.onrender.com/healthz` → `{"status":"ok"}`
- `https://<servis>.onrender.com/api/health` → `{"status":"ok","db":"ok","storage":"ok"}`
  (`storage: down` bo'lsa S3 qiymatlarini va bucket nomini tekshiring.)
- `/panel` → owner bilan kiring → taklifnoma yarating, rasm yuklang → `/<slug>` ochilsin, rasm ko'rinsin.
- RSVP yuboring; Telegram ulangan bo'lsa, xabar kelishini tekshiring.

**Mijoz IP'si (RSVP rate limit uchun):** Render env'ga `DEBUG_FORWARDED=1` qo'shing, bitta RSVP yuboring va logda
`[proxy] ... xff="A, B"` qatoriga qarang: oxirgidan oldingi qiymat (`A`) sizning haqiqiy IP'ingiz bo'lishi kerak
(https://ifconfig.me bilan solishtiring). Shunday bo'lsa `TRUST_PROXY=2` to'g'ri. Keyin `DEBUG_FORWARDED` ni o'chiring.

## Bepul rejimning cheklovlari va maslahatlar

- **Uxlash:** 15 daqiqa so'rov bo'lmasa servis uxlaydi, keyingi birinchi ochilish 30–60 s davom etadi.
  Oldini olish (ixtiyoriy): https://cron-job.org da har 10 daqiqada `https://<servis>.onrender.com/healthz` ga so'rov.
  Bitta servis 24/7 ≈ 730 soat, limit 750, demak sig'adi (boshqa bepul servislaringiz bo'lmasa).
- **Supabase** 7 kun faollik bo'lmasa bepul loyihani pauza qiladi, shunda rasmlar ochilmay qoladi. Dashboard'dan
  *Restore* qilinadi. Faol ishlatilayotgan bo'lsa muammo emas.
- Render'ning lokal disk'i vaqtinchalik, lekin ilova faylni Supabase'ga, ma'lumotni Neon'ga yozadi: hech narsa yo'qolmaydi.
- **O'z domeningiz:** Render → Settings → Custom Domains → DNS yozuvini qo'shing, keyin `PUBLIC_WEB_URL=https://domen.uz`
  va `NG_ALLOWED_HOSTS=domen.uz` env'larini bering.
