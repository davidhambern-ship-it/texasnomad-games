import tngApi from './tngApiDispatcher.mjs';

function makeHeaders(input = {}) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined || value === null) continue;
    const name = key.toLowerCase();
    if (['host', 'connection', 'content-length'].includes(name)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return headers;
}

export async function dispatchTngApi({ path = '/', method = 'GET', headers = {}, body } = {}) {
  const url = new URL(path, 'https://tng.internal');
  const init = { method, headers: makeHeaders(headers) };
  if (!['GET', 'HEAD'].includes(method) && body !== undefined && body !== null) {
    init.body = Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body);
    if (!init.headers.has('content-type')) init.headers.set('content-type', 'application/json');
  }
  return tngApi.fetch(new Request(url, init));
}

export async function handleTngApi(req, res) {
  const sourceUrl = new URL(req.url || '/tng-api', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/tng-api/, '') || '/';
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await dispatchTngApi({
    path: `${path}${sourceUrl.search}`,
    method: req.method || 'GET',
    headers: req.headers,
    body,
  });
  const headers = {};
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}
