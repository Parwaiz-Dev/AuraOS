import request from 'supertest';
import { createApp } from '@/app';

describe('Health Check', () => {
  const app = createApp();

  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('should return API status', async () => {
    const response = await request(app)
      .get('/api/v1/status')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('running');
  });
});
