import { onRequest as proxyTngApi } from '../src/lib/cloudflarePagesProxy.js';

export async function onRequest(context) {
  return proxyTngApi(context);
}
