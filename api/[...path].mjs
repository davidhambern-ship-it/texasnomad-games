// Vercel entry point for the existing TNG Node HTTP + WebSocket server.
// The server normalizes the /api/tng mount prefix before dispatching routes.
import server from '../server.mjs';

export default server;
