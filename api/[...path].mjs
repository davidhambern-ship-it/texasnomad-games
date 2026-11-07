// Vercel Node Function entry point for the shared TNG HTTP router.
// Vercel expects a request handler, not a listening http.Server instance.
// Reuse the request listener created in server.mjs so all game routes keep
// one shared backend entry point and stay within the Hobby function limit.
import server from '../server.mjs';

export default function handler(req, res) {
  server.emit('request', req, res);
}
