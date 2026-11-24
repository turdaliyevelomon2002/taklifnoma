/**
 * Seed: owner akkauntini yaratadi/yangilaydi va demo taklifnoma ("ali-madina") qo'shadi.
 * Ishga tushirish: npm run db:seed (Docker'da: node dist-seed/seed.js)
 * SEED_DEMO=false bo'lsa demo taklifnoma yaratilmaydi (production).
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getPrimaryEvent, invitationConfigSchema, type InvitationConfigInput } from '@taklifnoma/shared';
import * as argon2 from 'argon2';
import 'dotenv/config';

const prisma = new PrismaClient();

const DEMO_SLUG = 'ali-madina';

function demoConfig(): InvitationConfigInput {
  const year = new Date().getFullYear() + 1;
  const venue = {
    name: { uz: '"Oqsaroy" to\'yxonasi', ru: 'Ресторан «Оксарой»' },
    address: { uz: 'Toshkent sh., Yunusobod tumani, Amir Temur ko\'chasi 108', ru: 'г. Ташкент, Юнусабадский р-н, ул. Амира Темура 108' },
    location: { lat: 41.3385, lng: 69.2847 },
  };
  return {
    version: 1,
    locales: ['uz', 'ru'],
    defaultLocale: 'uz',
    timezone: 'Asia/Tashkent',
    couple: {
      groom: { firstName: { uz: 'Ali', ru: 'Али' }, parents: { uz: 'Karimovlar oilasining o\'g\'li', ru: 'Сын семьи Каримовых' } },
      bride: { firstName: { uz: 'Madina', ru: 'Мадина' }, parents: { uz: 'Rahimovlar oilasining qizi', ru: 'Дочь семьи Рахимовых' } },
      order: 'groom-first',
    },
    greeting: {
      uz: 'Hurmatli mehmonlarimiz! Sizni hayotimizdagi eng baxtli kun, nikoh to\'yimizga taklif qilamiz.',
      ru: 'Дорогие гости! Приглашаем вас разделить с нами самый счастливый день нашей жизни.',
    },
    hashtag: '#AliMadina',
    events: [
      {
        id: 'nahorgi-osh',
        title: { uz: 'Nahorgi osh', ru: 'Утренний плов' },
        startsAt: `${year}-06-14T06:00:00+05:00`,
        endsAt: `${year}-06-14T08:00:00+05:00`,
        venue,
        isPrimary: false,
      },
      {
        id: 'toy',
        title: { uz: 'Nikoh to\'yi', ru: 'Свадебное торжество' },
        startsAt: `${year}-06-14T18:00:00+05:00`,
        endsAt: `${year}-06-14T23:00:00+05:00`,
        venue,
        isPrimary: true,
      },
    ],
    musicTitle: 'Yalla — Uchquduq',
    rsvp: { maxGuestsPerReply: 5, askPhone: true, askWish: true, deadline: `${year}-06-07T23:59:00+05:00` },
  };
}

async function main(): Promise<void> {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error('OWNER_EMAIL va OWNER_PASSWORD .env da bo\'lishi kerak');
  if (password.length < 10) throw new Error('OWNER_PASSWORD kamida 10 belgi bo\'lsin');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.owner.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`✔ Owner: ${email}`);

  if (process.env.SEED_DEMO === 'false') return;

  if (await prisma.invitation.findUnique({ where: { slug: DEMO_SLUG } })) {
    console.log(`• Demo taklifnoma mavjud: /${DEMO_SLUG} (o'tkazib yuborildi)`);
    return;
  }

  const config = invitationConfigSchema.parse(demoConfig());
  const token = randomBytes(32).toString('base64url');
  const pin = Array.from({ length: 6 }, () => randomInt(0, 10)).join('');
  const eventDate = new Date(getPrimaryEvent(config).startsAt);

  await prisma.invitation.create({
    data: {
      slug: DEMO_SLUG,
      templateKey: 'classic-gold',
      package: 'PREMIUM',
      status: 'ACTIVE',
      publishedAt: new Date(),
      config,
      eventDate,
      expiresAt: new Date(eventDate.getTime() + 60 * 24 * 3600 * 1000),
      adminTokenHash: createHash('sha256').update(token).digest('hex'),
      adminPinHash: await argon2.hash(pin, { type: argon2.argon2id }),
      telegramLinkCode: randomBytes(8).toString('hex'),
      customerName: 'Ali Karimov',
      customerPhone: '+998901234567',
      price: 500000,
    },
  });

  const webUrl = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:4200').replace(/\/+$/, '');
  console.log(`✔ Demo taklifnoma: ${webUrl}/${DEMO_SLUG}`);
  console.log(`  Juftlik havolasi: ${webUrl}/${DEMO_SLUG}/admin#k=${token}`);
  console.log(`  PIN: ${pin}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
