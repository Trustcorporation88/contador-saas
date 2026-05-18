import request from 'supertest';
import app from '../../src/app';

describe('API performance smoke', () => {
  it('responds /health with p95 below 250ms', async () => {
    const samples: number[] = [];

    for (let i = 0; i < 30; i += 1) {
      const start = process.hrtime.bigint();
      const res = await request(app).get('/health');
      const end = process.hrtime.bigint();

      expect(res.status).toBe(200);
      samples.push(Number(end - start) / 1_000_000);
    }

    samples.sort((a, b) => a - b);
    const p95Index = Math.floor(samples.length * 0.95) - 1;
    const p95 = samples[Math.max(0, p95Index)];

    expect(p95).toBeLessThan(250);
  });

  it('responds /api/v1/status with p95 below 300ms', async () => {
    const samples: number[] = [];

    for (let i = 0; i < 30; i += 1) {
      const start = process.hrtime.bigint();
      const res = await request(app).get('/api/v1/status');
      const end = process.hrtime.bigint();

      expect(res.status).toBe(200);
      samples.push(Number(end - start) / 1_000_000);
    }

    samples.sort((a, b) => a - b);
    const p95Index = Math.floor(samples.length * 0.95) - 1;
    const p95 = samples[Math.max(0, p95Index)];

    expect(p95).toBeLessThan(300);
  });
});
