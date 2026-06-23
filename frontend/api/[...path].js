const UPSTREAM_BASE_URL = process.env.BACKEND_URL?.replace(/\/$/, '');

if (!UPSTREAM_BASE_URL) {
  console.error('[api proxy] BACKEND_URL não configurada no Vercel');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (!UPSTREAM_BASE_URL) {
    return new Response(
      JSON.stringify({
        error: 'BACKEND_URL não configurada',
        message: 'Defina BACKEND_URL no Vercel apontando para o backend Railway.',
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const requestUrl = new URL(request.url);
  const upstreamPath = requestUrl.pathname.replace(/^\/api/, '');
  const upstreamUrl = new URL(`/api${upstreamPath}${requestUrl.search}`, UPSTREAM_BASE_URL);

  // Build clean headers for upstream - keep content-type, authorization, accept
  const upstreamHeaders = new Headers();
  const passthroughHeaders = [
    'content-type',
    'authorization',
    'accept',
    'accept-language',
    'accept-encoding',
    'x-tenant-id',
    'x-request-id',
    'user-agent',
  ];
  for (const name of passthroughHeaders) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  if (body !== undefined && body.byteLength > 0) {
    upstreamHeaders.set('content-length', String(body.byteLength));
  }

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: 'manual',
  });

  // Forward response as-is (Vercel serves it same-origin so CORS not needed)
  const responseHeaders = new Headers();
  const passthroughResponseHeaders = [
    'content-type',
    'content-length',
    'cache-control',
    'set-cookie',
    'x-request-id',
  ];
  for (const name of passthroughResponseHeaders) {
    const value = upstreamResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
