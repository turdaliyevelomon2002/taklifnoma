# Ishga tushirish va deploy yo'riqnomasi

Tartib: **1)** kompyuterda sinash → **2)** domen → **3)** server → **4)** Telegram → **5)** yakuniy tekshiruv.

---

## 1. Kompyuterda sinab ko'rish

### 1.1. Docker Desktop
Ma'lumotlar bazasi va fayl ombori Docker'da ishlaydi.
1. Docker Desktop'ni to'liq yoping (pastki o'ngdagi ikonka → Quit) va qayta oching.
2. Ishlamasa: PowerShell'ni **administrator** sifatida ochib `wsl --update`, keyin kompyuterni qayta yoqing.
3. Docker Desktop → Settings → General: "Use the WSL 2 based engine" belgilangan bo'lsin.
4. Tekshirish: `docker info` versiya chiqarsa, tayyor.

### 1.2. 3000-port band bo'lsa
API 3000-portni ishlatadi. Uni boshqa dastur egallagan bo'lsa, o'sha dasturni yoping **yoki**:
- `apps/api/.env`: `PORT=3000` → `PORT=3010`
- `apps/web/proxy.conf.json`: `localhost:3000` → `localhost:3010`

### 1.2.1. Port band bo'lsa (5434, 8333)
Boshqa loyiha shu portlarni ishlatsa, `docker-compose.dev.yml` dagi chap tomondagi portni va `apps/api/.env` dagi mos manzilni (`DATABASE_URL` yoki `S3_ENDPOINT`/`S3_PUBLIC_URL`) birga o'zgartiring.

### 1.3. Ishga tushirish
Loyiha papkasida:
```bash
npm install
npm run dev:infra       # PostgreSQL :5434 + SeaweedFS S3 :8333 (Docker)
npm run db:migrate      # jadvallar
npm run db:seed         # owner akkaunti + demo "ali-madina"
```
`db:seed` oxirida demo taklifnomaning **juftlik havolasi va PIN** chiqadi: yozib oling.

Yana ikkita alohida terminalda:
```bash
npm run dev:api         # API
npm run dev:web         # sayt: http://localhost:4200
```

### 1.4. Nimani sinash kerak
1. http://localhost:4200/panel → login/parol: `apps/api/.env` dagi `OWNER_EMAIL` / `OWNER_PASSWORD`.
2. "Yangi taklifnoma" → to'ldirib saqlang. Chiqqan havola va PIN'ni saqlang (qayta ko'rsatilmaydi).
3. "Rasm va musiqa" tabida muqova va galereya rasmlarini yuklang.
4. "Ko'rib chiqish" → "Nashr qilish".
5. `http://localhost:4200/<slug>`: shablon, xarita, RSVP formasi.
6. Juftlik havolasi + PIN: mehmonlar ro'yxati, Excel.
7. "Ma'lumotlar" tabida shablonni almashtirib uchalasini ko'ring.

Telefondan ko'rish uchun `localhost` ishlamaydi: buning uchun serverga chiqarish kerak (3-qism).

### 1.5. Telegram'ni lokal sinash (domen kerak emas)
1. Telegram'da **@BotFather** → `/newbot` → nom (masalan "Taklifnoma Test"), username `..._bot` bilan tugasin.
2. Tokenni `apps/api/.env` dagi `TELEGRAM_BOT_TOKEN=` ga yozing.
3. API'ni qayta ishga tushiring: logda `Telegram bot: @...` chiqadi (lokalda avtomatik polling rejimi).
4. Panel tepasidagi **"Telegram'ni ulash"** → botda **Start**: endi barcha yangi javoblar sizga keladi.
5. Taklifnoma → "Kirish va sozlamalar" tabidagi havolani juftlik ochib Start bossa, javoblar ularga ham keladi.
6. Taklifnoma sahifasidan RSVP yuboring: xabar bir necha soniyada keladi.

---

## 2. Domen
1. `.uz` domenini akkreditatsiyalangan registratorda oling (ro'yxat: cctld.uz). `.com` ham bo'ladi.
2. Registrator panelidagi DNS bo'limida:

| Turi | Nomi | Qiymati |
|---|---|---|
| A | `@` | server IP |
| A | `www` | server IP |

3. Tarqalishi 10 daqiqadan bir necha soatgacha. Tekshirish: `nslookup domen.uz` server IP'sini ko'rsatsin.

---

## 3. Server (VPS)

### 3.1. Server tanlash
- **Ubuntu 24.04**, kamida **2 vCPU / 4 GB RAM**, 40 GB disk.
- 2 GB RAM'da Angular build xotira yetmay to'xtab qolishi mumkin: unda pastdagi swap qadamini albatta bajaring.
- Mehmonlar asosan O'zbekistonda: mahalliy yoki Yevropa data-markazi tezroq.

### 3.2. Serverni tayyorlash
```bash
ssh root@SERVER_IP

apt update && apt upgrade -y
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable

# swap (RAM kam bo'lsa)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Docker
curl -fsSL https://get.docker.com | sh
```

### 3.3. Loyiha va sozlamalar
```bash
git clone https://github.com/turdaliyevelomon2002/taklifnoma.git
cd taklifnoma
cp .env.production.example .env
nano .env
```
Har bir maxfiy qiymat uchun alohida yangi qator yarating: `openssl rand -hex 32`.

| Maydon | Qiymat |
|---|---|
| `DOMAIN` | `domen.uz` (`https://` siz) |
| `ACME_EMAIL` | emailingiz (SSL sertifikati xabarlari) |
| `POSTGRES_PASSWORD`, `S3_SECRET_KEY` | `openssl rand -hex 32` |
| `OWNER_JWT_SECRET`, `COUPLE_JWT_SECRET`, `RSVP_SECRET` | `openssl rand -hex 32` |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | panelga kirish (parol kamida 10 belgi, kuchli) |
| `TELEGRAM_BOT_TOKEN` | 4-qismdagi **production** bot tokeni |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `TELEGRAM_MINIAPP_NAME` | Mini App qisqa nomi (4-qism, 4-qadam); "faqat Telegram orqali javob" uchun |

Saqlash: `Ctrl+O`, Enter, `Ctrl+X`.

> Bu `.env` git'ga tushmaydi (`.gitignore` da). Haqiqiy parollarni hech qachon `apps/api/.env` ga yozmang: u repo'da.

### 3.4. Ishga tushirish
DNS tarqalganiga ishonch hosil qiling, keyin:
```bash
docker compose up -d --build          # birinchi marta 5–15 daqiqa
docker compose ps                     # hammasi "healthy"
docker compose run --rm api node dist-seed/seed.js   # owner akkaunti
```
Tekshirish:
- `https://domen.uz/api/health` → `"status":"ok"`
- `https://domen.uz/panel` → login

SSL'ni Caddy avtomatik oladi. `https` ishlamasa, odatda DNS hali tarqalmagan: `docker compose logs caddy`.

Xato bo'lsa: `docker compose logs api web caddy`.

### 3.5. Yangilash
```bash
cd ~/taklifnoma && git pull && docker compose up -d --build
```
Migratsiyalar avtomatik qo'llanadi.

---

## 4. Telegram (production)
1. @BotFather'da **alohida bot** yarating (masalan `taklifnoma_bot`). Test boti lokal uchun qoladi.
   Sababi: lokal API ishga tushganda bot webhook'ini o'chiradi; bitta bot ikkala joyda ishlatilsa, serverga xabar kelmay qoladi.
2. Tokenni serverdagi `.env` ga, `TELEGRAM_WEBHOOK_SECRET` ni ham yozing → `docker compose up -d api`. Webhook avtomatik o'rnatiladi (`docker compose logs api`).
3. Ixtiyoriy (BotFather): `/setuserpic` (rasm), `/setdescription`, `/setabouttext`.
4. Panelda **"Telegram'ni ulash"** → Start.
5. **Mini App** (mehmonlarni Telegram akkaunti bilan tanish uchun):
   - @BotFather → `/newapp` → botni tanlang → nom, tavsif, 640×360 rasm.
   - **Web App URL**: `https://domen.uz/tg`
   - **Short name**: masalan `taklif` → havola `https://t.me/taklifnoma_bot/taklif` bo'ladi.
   - Short name'ni `.env` dagi `TELEGRAM_MINIAPP_NAME` ga yozing → `docker compose up -d api`.
   - Panel → taklifnoma → "Kirish va sozlamalar": mehmonlar uchun havola (`...?startapp=<slug>`) shu yerda.
   - Taklifnoma "Javob formasi" bo'limida **"Faqat Telegram orqali javob"** belgisini yoqing.

---

## 5. Yakuniy tekshiruv (server'da)
1. Panelda taklifnoma yarating, rasm yuklang, nashr qiling.
2. `https://domen.uz/<slug>` ni **telefondan** oching. Havolani Telegram'da yuborib ko'rinishini (rasm, sarlavha) tekshiring.
   Telegram ko'rinishni keshlaydi: rasm almashtirilsa, @WebpageBot'ga havolani yuborib yangilang.
3. Boshqa telefondan RSVP yuboring: owner va juftlikka Telegram xabari kelsin.
4. Juftlik havolasi + PIN: mehmonlar, Excel.
5. Zaxira nusxani sozlang (README → "Zaxira nusxa"): kamida kunlik baza dump'i.

---

## Tez-tez uchraydigan muammolar

| Belgi | Sabab / yechim |
|---|---|
| `docker info` javob bermaydi | Docker Desktop'ni qayta oching, `wsl --update`, kompyuterni qayta yoqing |
| `EADDRINUSE :3000` | 3000-port band: 1.2-bandga qarang |
| Panel login: "Email yoki parol noto'g'ri" | `db:seed` (lokal) yoki `seed.js` (server) bajarilganmi, `.env` dagi email/parol to'g'rimi |
| Rasm yuklanmaydi | SeaweedFS ishlayaptimi: `docker compose ps`, `/api/health` dagi `storage` |
| Telegram xabari kelmaydi | Token to'g'rimi, botda Start bosilganmi, lokal va server bir xil botni ishlatmayaptimi |
| `https` ochilmaydi | DNS A yozuvlari, 80/443 portlar ochiqmi (`ufw status`), `docker compose logs caddy` |
| Build paytida server qotib qoladi | RAM yetmayapti: swap qo'shing (3.2) |
