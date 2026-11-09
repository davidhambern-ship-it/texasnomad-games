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
    path === "/tng-rooms" ||
    path.startsWith("/tng-rooms/") ||
    path === "/nc-api" ||
    path.startsWith("/nc-api/") ||
    path === "/bs-api" ||
    path.startsWith("/bs-api/");

  if (!isApi) {
    const response = await next();
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-TNG-Pages-Proxy", "bypass");
    responseHeaders.set("X-TNG-Pages-Path", path);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  const upstreamUrl = new URL(EDGE_API);
  upstreamUrl.pathname += path;
  upstreamUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const requestBody = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: requestBody,
    redirect: "manual",
  });

  try {
    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("X-TNG-Pages-Proxy", "forwarded");
    responseHeaders.set("X-TNG-Pages-Path", path);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[TNG Pages API proxy]", error);
    return Response.json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "The TNG game service is temporarily unavailable.",
      },
    }, { status: 503, headers: {
      "Cache-Control": "no-store",
      "X-TNG-Pages-Proxy": "upstream-error",
      "X-TNG-Pages-Path": path,
    } });
  }
}
