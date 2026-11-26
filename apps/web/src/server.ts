import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
// Nginx ortida: to'g'ri protokol/host aniqlanishi uchun.
app.set('trust proxy', Number(process.env['TRUST_PROXY'] ?? 0));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Ixtiyoriy: /api/* ni shu serverning o'zi API'ga uzatadi (Caddy/nginx bo'lmagan hosting, masalan Render).
 * Brauzer uchun hammasi bitta domen bo'lib qoladi: cookie va nisbiy "/api" o'zgarishsiz ishlaydi.
 * Body oqim (stream) sifatida uzatiladi, hajm cheklovini API o'zi tekshiradi.
 */
const apiProxyTarget = process.env['API_PROXY_TARGET'];
if (apiProxyTarget) {
  const target = new URL(apiProxyTarget);
  const debugForwarded = process.env['DEBUG_FORWARDED'] === '1';
  app.use('/api', (req, res) => {
    const remote = req.socket.remoteAddress ?? '';
    const prior = req.headers['x-forwarded-for'];
    const headers = { ...req.headers };
    // API TRUST_PROXY hop soni bo'yicha haqiqiy IP'ni tanlaydi: oldingi zanjir + bizga ulangan proksi.
    headers['x-forwarded-for'] = prior ? `${String(prior)}, ${remote}` : remote;
    headers['x-forwarded-proto'] ??= req.protocol;
    headers['x-forwarded-host'] ??= req.headers.host ?? '';
    if (debugForwarded) {
      console.log(`[proxy] ${req.method} ${req.originalUrl} xff="${headers['x-forwarded-for']}"`);
    }

    const upstream = httpRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: req.originalUrl,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      console.error(`[proxy] ${req.method} ${req.originalUrl}: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ statusCode: 502, code: 'BAD_GATEWAY' });
      } else {
        res.destroy(err);
      }
    });
    // Mijoz ulanishni uzsa, API'ga so'rovni ham to'xtatamiz.
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
  });
}

/** Statik fayllar: nomlarida hash bor, shuning uchun uzoq muddatli kesh. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
  }),
);

/** Panellar qidiruv tizimlariga ko'rinmasin va keshlanmasin (meta tegi faqat JS'dan keyin qo'yiladi). */
app.use(/^\/(panel(\/.*)?|[^/]+\/admin)$/, (_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/** Qolgan barcha so'rovlar Angular SSR orqali render qilinadi. */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`SSR server: http://localhost:${port}`);
  });
}

/** Angular CLI (dev-server va build) uchun request handler. */
export const reqHandler = createNodeRequestHandler(app);
