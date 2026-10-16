/**
 * Minimal static server for the production build, mirroring the hosting rules in
 * vercel.json / public/_redirects: real file → <dir>/index.html (prerendered public
 * routes) → 200.html (SPA shell for private routes). Text assets are gzip-compressed as
 * every production host does, so Lighthouse measures realistic transfer sizes.
 *
 *   node scripts/serve-dist.mjs [port=5173]
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2] || process.env.PORT || 5173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const safe = path.normalize(pathname).replace(/^([/\\])+/, '');
  const candidates = [
    path.join(dist, safe),
    path.join(dist, safe, 'index.html'),
    path.join(dist, '200.html'),
  ];
  for (const file of candidates) {
    if (!file.startsWith(dist) || !(await isFile(file))) continue;
    const extension = path.extname(file);
    const compressible = /\.(css|html|js|json|svg|txt|webmanifest|xml)$/.test(extension);
    const gzip = compressible && /gzip/i.test(request.headers['accept-encoding'] || '');
    response.writeHead(200, {
      'Cache-Control': file.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'Content-Type': types[extension] || 'application/octet-stream',
      ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
    });
    const stream = createReadStream(file);
    (gzip ? stream.pipe(createGzip()) : stream).pipe(response);
    return;
  }
  response.writeHead(404).end('Not found');
}).listen(port, () => console.log(`Serving ${dist} on http://localhost:${port}`));
