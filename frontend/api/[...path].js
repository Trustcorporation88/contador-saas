const UPSTREAM_BASE_URL =
  process.env.BACKEND_URL ||
  'https://contador-backend-staging.onrender.com';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
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
