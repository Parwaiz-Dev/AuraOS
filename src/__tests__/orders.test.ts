import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()
let token: string
let restaurantId: string
let menuItemId: string
let tableId: string | null = null

describe('Orders Endpoints', () => {
  beforeAll(async () => {
    // Login and get token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo-kitchen.local',
        password: 'demo123',
      })
    token = loginResponse.body.data.token
    restaurantId = loginResponse.body.data.user.restaurant_id

    const tableResult = await pool.query(
      `SELECT id FROM restaurant_tables WHERE restaurant_id = $1 LIMIT 1`,
      [restaurantId]
    )
    tableId = tableResult.rows[0]?.id || null

    const menuItemResult = await pool.query(
      `SELECT id FROM menu_items LIMIT 1`
    )
    menuItemId = menuItemResult.rows[0]?.id || 'fa67c96d-7cb0-43da-9be7-ea16e8a9fb7c'
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('GET /api/v1/orders', () => {
    it('should return list of orders with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/v1/orders')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/orders', () => {
    it('should create new order with valid data', async () => {
      const payload: any = {
        order_type: 'PARCEL',
        order_source: 'WAITER',
        items: [
          {
            menu_item_id: menuItemId,
            quantity: 2,
          },
        ],
      }

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.order).toHaveProperty('id')
      expect(response.body.data.order.status).toBe('CREATED')
    })

    it('should return 422 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          table_id: tableId,
        })

      expect(response.status).toBe(422)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/orders/stats', () => {
    it('should return order statistics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/orders/stats')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('total_orders_today')
      expect(response.body.data).toHaveProperty('completed_orders_today')
      expect(response.body.data).toHaveProperty('revenue_today')
    })
  })
})