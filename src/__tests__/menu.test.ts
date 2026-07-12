import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()
let token: string
let restaurantId: string
let categoryId: string

describe('Menu Endpoints', () => {
  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo-kitchen.local', password: 'demo123' })
    token = loginRes.body.data.token
    restaurantId = loginRes.body.data.user.restaurant_id

    const catRes = await pool.query(
      `SELECT id FROM menu_categories WHERE restaurant_id = $1 LIMIT 1`,
      [restaurantId],
    )
    categoryId = catRes.rows[0]?.id
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('GET /api/v1/menus', () => {
    it('should return full menu', async () => {
      const res = await request(app)
        .get('/api/v1/menus')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/menus')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/menus/categories', () => {
    it('should list categories', async () => {
      const res = await request(app)
        .get('/api/v1/menus/categories')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('POST /api/v1/menus/items', () => {
    it('should create a menu item', async () => {
      const res = await request(app)
        .post('/api/v1/menus/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Test Item ${Date.now()}`,
          price: 99.50,
          category_id: categoryId,
          prep_time_minutes: 10,
          is_vegetarian: true,
        })
      expect(res.status).toBe(201)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.price).toBe('99.50')
    })

    it('should reject item with missing name', async () => {
      const res = await request(app)
        .post('/api/v1/menus/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 10, category_id: categoryId })
      expect(res.status).toBe(422)
    })
  })

  describe('GET /api/v1/menus/stats', () => {
    it('should return menu statistics', async () => {
      const res = await request(app)
        .get('/api/v1/menus/stats')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('total_items')
    })
  })
})
