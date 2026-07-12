import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()
let token: string
let restaurantId: string
let inventoryItemId: string

describe('Inventory Endpoints', () => {
  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo-kitchen.local', password: 'demo123' })
    token = loginRes.body.data.token
    restaurantId = loginRes.body.data.user.restaurant_id

    const invRes = await pool.query(
      `SELECT id FROM inventory_items WHERE restaurant_id = $1 LIMIT 1`,
      [restaurantId],
    )
    inventoryItemId = invRes.rows[0]?.id
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('GET /api/v1/inventory', () => {
    it('should list inventory items', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/inventory')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/inventory/:id', () => {
    it('should return a single inventory item', async () => {
      if (!inventoryItemId) return // skip if no seed data
      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryItemId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('current_stock')
    })

    it('should return 404 for non-existent id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/v1/inventory/:id', () => {
    it('should update stock level', async () => {
      if (!inventoryItemId) return
      const res = await request(app)
        .put(`/api/v1/inventory/${inventoryItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ current_stock: 200, reorder_level: 20 })
      expect(res.status).toBe(200)
      expect(Number(res.body.data.current_stock)).toBe(200)
    })
  })

  describe('GET /api/v1/inventory/stats', () => {
    it('should return inventory stats', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/stats')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('total_items')
    })
  })
})
