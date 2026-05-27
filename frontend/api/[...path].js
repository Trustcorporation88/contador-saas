// Use production backend if available, fallback to staging for development
const UPSTREAM_BASE_URL = process.env.VERCEL_ENV === 'production' 
  ? 'https://contador-backend-production.onrender.com'  // Production backend
  : 'https://contador-backend-staging.onrender.com';  // Staging backend

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const { method, headers, url, body } = req;
  
  const requestUrl = new URL(url, `https://${headers.host}`);
  const upstreamPath = requestUrl.pathname.replace(/^\/api/, '');
  const upstreamUrl = new URL(`/api${upstreamPath}${requestUrl.search}`, UPSTREAM_BASE_URL);

  // Build clean headers for upstream - keep content-type, authorization, accept
  const upstreamHeaders = {};
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
    const value = headers[name];
    if (value) upstreamHeaders[name] = value;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method,
      headers: upstreamHeaders,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
      redirect: 'manual',
    });

    // Copy response headers
    const responseHeaders = {};
    const passthroughResponseHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'set-cookie',
      'x-request-id',
    ];
    for (const name of passthroughResponseHeaders) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders[name] = value;
    }

    // Set headers and return response
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(upstreamResponse.status);
    res.send(await upstreamResponse.text());
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway' });
  }
}
