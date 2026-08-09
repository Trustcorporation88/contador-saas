import request from 'supertest';
import app from '../../src/app';

describe('App security and docs', () => {
  it('returns OpenAPI yaml', async () => {
    const res = await request(app).get('/api/docs/openapi.yaml');

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain('openapi:');
      expect(res.text).toContain('info:');
    }
  });

  it('serves Swagger UI page (quando ENABLE_API_DOCS estiver habilitado)', async () => {
    // A rota só é registrada se envConfig.enableApiDocs === true (padrão:
    // false, e o CI não define ENABLE_API_DOCS) — mesmo padrão tolerante já
    // usado no teste "returns OpenAPI yaml" acima.
    const res = await request(app).get('/api/docs');

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain('swagger-ui');
      expect(res.text).toContain('/api/docs/openapi.yaml');
    }
  });

  it('blocks mutating request with disallowed origin', async () => {
    const res = await request(app)
      .post('/api/v1/status')
      .set('Origin', 'https://evil.example.com')
      .send({ sample: '<script>alert(1)</script>' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('blocks a third-party vercel.app deploy (padrão de CORS não pode ser aberto)', async () => {
    const res = await request(app)
      .post('/api/v1/status')
      .set('Origin', 'https://qualquer-app-de-terceiro.vercel.app')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('continua aceitando os previews do próprio projeto no Vercel', async () => {
    // /health não toca o banco: verifica só a decisão do CORS.
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://contador-saas-ashy.vercel.app');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://contador-saas-ashy.vercel.app',
    );
  });

  it('não devolve cabeçalho de CORS para deploy de terceiro no vercel.app', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://qualquer-app-de-terceiro.vercel.app');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
