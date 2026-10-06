import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function cacheControl(filePath) {
  const normalized = String(filePath || '').replaceAll('\\\\', '/');
  const extension = extname(normalized).toLowerCase();

  if (extension === '.html' || normalized.endsWith('/build-meta.json')) {
    return 'no-store, no-cache, must-revalidate, max-age=0';
  }

  if (
    normalized.includes('/assets/') &&
    /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(normalized)
  ) {
    return 'public, max-age=31536000, immutable';
  }

  return 'public, max-age=0, must-revalidate';
}

async function sendFile(req, res, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': cacheControl(filePath),
    'Content-Length': body.length,
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  try {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\\\])+/, '');
    let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
      await sendFile(req, res, filePath);
      return;
    } catch {}

    await sendFile(req, res, join(root, 'index.html'));
  } catch (error) {
    console.error('[TNG web] request failed', error);
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('TNG web error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TNG web listening on port ${port}`);
});
