const UPSTREAM_BASE_URL = 'https://contador-backend-staging.onrender.com';

const REQUEST_HEADERS_TO_DROP = [
  'host',
  'origin',
  'referer',
  'content-length',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
];

const RESPONSE_HEADERS_TO_DROP = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
];

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const upstreamPath = requestUrl.pathname.replace(/^\/api/, '');
  const upstreamUrl = new URL(`/api${upstreamPath}${requestUrl.search}`, UPSTREAM_BASE_URL);

  const headers = new Headers(request.headers);
  for (const header of REQUEST_HEADERS_TO_DROP) {
    headers.delete(header);
  }
  headers.set('x-proxied-by', 'vercel-edge-proxy');

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const header of RESPONSE_HEADERS_TO_DROP) {
    responseHeaders.delete(header);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
