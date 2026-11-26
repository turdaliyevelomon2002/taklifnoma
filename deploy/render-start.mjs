// Bitta hosting servisida (Render free) API va web'ni birga ishga tushiradi:
//   1) prisma migrate deploy, 2) owner akkaunti seed (OWNER_EMAIL/OWNER_PASSWORD bo'lsa),
//   3) API ichki portda (127.0.0.1:API_PORT), 4) Angular SSR tashqi $PORT da, /api ni API'ga proksi qiladi.
// Jarayonlardan biri to'xtasa, ikkinchisi ham to'xtatiladi va hosting servisni qayta ishga tushiradi.
//   node deploy/render-start.mjs
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = join(root, 'apps/api');
const webDir = join(root, 'apps/web');
const prismaCli = join(root, 'node_modules/prisma/build/index.js');

const apiPort = process.env.API_PORT ?? '3000';
const webPort = process.env.PORT ?? '10000';
const apiOrigin = `http://127.0.0.1:${apiPort}`;
// Servisning tashqi manzili (Render beradi). O'z domeningiz ulansa PUBLIC_WEB_URL ni qo'lda bering.
const publicUrl = (process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const base = {
  ...process.env,
  NODE_ENV: 'production',
  COOKIE_SECURE: process.env.COOKIE_SECURE ?? 'true',
  ...(publicUrl && {
    PUBLIC_WEB_URL: publicUrl,
    CORS_ORIGINS: process.env.CORS_ORIGINS || publicUrl,
    ...(process.env.TELEGRAM_BOT_TOKEN && {
      TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || `${publicUrl}/api/telegram/webhook`,
    }),
  }),
};

const log = (msg) => console.log(`[start] ${msg}`);
const heap = (name, fallback) => `--max-old-space-size=${process.env[name] ?? fallback}`;

function runOnce(label, args, extraEnv = {}) {
  log(label);
  const r = spawnSync(process.execPath, args, { cwd: apiDir, env: { ...base, ...extraEnv }, stdio: 'inherit' });
  return r.status === 0;
}

if (process.env.RUN_MIGRATIONS !== 'false') {
  if (!runOnce('prisma migrate deploy', [prismaCli, 'migrate', 'deploy'])) {
    log("migratsiya muvaffaqiyatsiz: DATABASE_URL ni tekshiring");
    process.exit(1);
  }
}

if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
  // Idempotent: owner'ni yaratadi yoki yangilaydi. Xato bo'lsa ham ilova ishga tushaveradi.
  if (!runOnce('seed (owner akkaunti)', ['dist-seed/seed.js'], { SEED_DEMO: process.env.SEED_DEMO ?? 'false' })) {
    log('seed xato bilan tugadi (davom etamiz)');
  }
}

const children = [];
let stopping = false;

function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...base, ...env }, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    log(`${name} to'xtadi (code=${code}, signal=${signal}); hammasini to'xtatamiz`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 8000).unref();
  Promise.all(children.map((c) => (c.exitCode !== null ? null : new Promise((r) => c.once('exit', r))))).then(() =>
    process.exit(code),
  );
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

/** API birinchi javobini kutamiz (503 bo'lsa ham: demak HTTP server tayyor). */
async function waitForApi(timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until && !stopping) {
    try {
      await fetch(`${apiOrigin}/api/health`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

start('api', [heap('API_HEAP_MB', 220), 'dist/main.js'], apiDir, {
  PORT: apiPort,
  TRUST_PROXY: process.env.TRUST_PROXY ?? '2',
});

if (!(await waitForApi())) log("API 90 soniyada javob bermadi, web baribir ishga tushiriladi");

start('web', [heap('WEB_HEAP_MB', 160), 'dist/web/server/server.mjs'], webDir, {
  PORT: webPort,
  TRUST_PROXY: '0',
  API_INTERNAL_ORIGIN: apiOrigin,
  API_PROXY_TARGET: apiOrigin,
  NG_ALLOWED_HOSTS: process.env.NG_ALLOWED_HOSTS ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? 'localhost',
});
log(`tayyor: web :${webPort} -> api ${apiOrigin}`);
