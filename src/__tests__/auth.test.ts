import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()

describe('Authentication Endpoints', () => {
  afterAll(async () => {
    await pool.end()
  })

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 with token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@demo-kitchen.local',
          password: 'demo123',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('token')
      expect(response.body.data).toHaveProperty('user')
      expect(response.body.data.user.email).toBe('admin@demo-kitchen.local')
    })

    it('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.local',
          password: 'password123',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@demo-kitchen.local',
          password: 'wrongpassword',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should return 422 for missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'password123',
        })

      expect(response.status).toBe(422)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/auth/me', () => {
    let token: string

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@demo-kitchen.local',
          password: 'demo123',
        })
      token = loginResponse.body.data.token
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('email')
    })

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})