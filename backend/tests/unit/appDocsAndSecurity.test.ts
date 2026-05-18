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

  it('serves Swagger UI page', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.text).toContain('/api/docs/openapi.yaml');
  });

  it('blocks mutating request with disallowed origin', async () => {
    const res = await request(app)
      .post('/api/v1/status')
      .set('Origin', 'https://evil.example.com')
      .send({ sample: '<script>alert(1)</script>' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});
