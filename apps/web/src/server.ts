import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
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
