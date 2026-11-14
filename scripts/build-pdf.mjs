/**
 * Post-build step: print dist/resume/index.html to dist/resume/<pdfFilename>
 * with headless Chromium, so the PDF always matches the HTML. Chromium's PDF
 * output keeps text as real (selectable, ATS-readable) text.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { site } from '../src/site.config.ts';

const DIST = resolve('dist');
const OUT = join(DIST, 'resume', site.resume.pdfFilename);
const EXPECTED_PAGES = 2;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function resolveFile(urlPath) {
  const path = normalize(join(DIST, decodeURIComponent(urlPath.split('?')[0])));
  if (path !== DIST && !path.startsWith(DIST + sep)) return null;
  if (existsSync(path) && statSync(path).isDirectory()) return join(path, 'index.html');
  return path;
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file || !existsSync(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await page.goto(`http://127.0.0.1:${port}/resume/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  if (failed.length) throw new Error(`Resources failed to load:\n${failed.join('\n')}`);

  await page.pdf({
    path: OUT,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
  });
  const pages = readFileSync(OUT, 'latin1').match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
  console.log(`PDF written: ${OUT} (${pages} pages)`);
  if (pages > EXPECTED_PAGES) {
    console.warn(`⚠ Resume PDF runs to ${pages} pages (design is ${EXPECTED_PAGES}); trim resume.md or tighten print CSS.`);
  }
} finally {
  await browser.close();
  server.close();
}
