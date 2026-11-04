const EDGE_API = "https://ngzrthwhjwtayhhwintc.supabase.co/functions/v1/tng-edge-api";

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const isApi =
    path === "/healthz" ||
    path === "/tng-guest" ||
    path.startsWith("/tng-guest/") ||
    path === "/tng-api" ||
    path.startsWith("/tng-api/") ||
    path === "/nc-api" ||
    path.startsWith("/nc-api/");

  if (!isApi) return next();

  const upstreamUrl = new URL(EDGE_API);
  upstreamUrl.pathname += path;
  upstreamUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  try {
    return await fetch(upstreamRequest);
  } catch (error) {
    console.error("[TNG Pages API proxy]", error);
    return Response.json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "The TNG game service is temporarily unavailable.",
      },
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
