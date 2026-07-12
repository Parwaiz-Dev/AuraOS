import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()
let adminToken: string
let restaurantId: string
let orderId: string

describe('Payments Endpoints', () => {
  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo-kitchen.local', password: 'demo123' })
    adminToken = loginResponse.body.data.token
    restaurantId = loginResponse.body.data.user.restaurant_id

    // Create an order to attach payments to
    const menuItem = await pool.query(`SELECT id FROM menu_items LIMIT 1`)
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        order_type: 'PARCEL',
        order_source: 'WAITER',
        items: [{ menu_item_id: menuItem.rows[0].id, quantity: 1 }],
      })
    orderId = orderRes.body.data.order.id
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('POST /api/v1/payments', () => {
    it('should create a payment for an order', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order_id: orderId, amount: 50, method: 'CASH', status: 'PAID' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.status).toBe('PAID')
    })

    it('should reject payment exceeding order total', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order_id: orderId, amount: 999999, method: 'CASH', status: 'PAID' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .send({ order_id: orderId, amount: 10, method: 'CASH' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/payments', () => {
    it('should return paginated payments list', async () => {
      const res = await request(app)
        .get('/api/v1/payments?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
      expect(res.body.data).toHaveProperty('hasMore')
    })

    it('should filter payments by status', async () => {
      const res = await request(app)
        .get('/api/v1/payments?status=PAID')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      for (const p of res.body.data.items) {
        expect(p.status).toBe('PAID')
      }
    })
  })

  describe('GET /api/v1/payments/stats', () => {
    it('should return stats for admin', async () => {
      const res = await request(app)
        .get('/api/v1/payments/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('payments_today')
      expect(res.body.data).toHaveProperty('paid_amount_today')
    })
  })
})
