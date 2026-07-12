import request from 'supertest'
import { createApp } from '@/app'
import { pool } from '@/config/database'

const app = createApp()
let adminToken: string
let waiterToken: string
let kitchenToken: string

describe('RBAC Authorization', () => {
  beforeAll(async () => {
    // Login as admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo-kitchen.local', password: 'demo123' })
    adminToken = adminRes.body.data.token

    // Login as waiter
    const waiterRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'waiter@demo-kitchen.local', password: 'demo123' })
    waiterToken = waiterRes.body.data.token

    // Login as kitchen
    const kitchenRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kitchen@demo-kitchen.local', password: 'demo123' })
    kitchenToken = kitchenRes.body.data.token
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('Admin-only endpoints', () => {
    it('should allow admin to list users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('should deny waiter from listing users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${waiterToken}`)
      expect(res.status).toBe(403)
    })

    it('should deny kitchen from listing users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${kitchenToken}`)
      expect(res.status).toBe(403)
    })

    it('should deny waiter from accessing reports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${waiterToken}`)
      expect(res.status).toBe(403)
    })

    it('should deny waiter from deleting orders', async () => {
      const res = await request(app)
        .delete('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${waiterToken}`)
      expect(res.status).toBe(403)
    })

    it('should deny kitchen from creating menu items', async () => {
      const res = await request(app)
        .post('/api/v1/menus/items')
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ name: 'Test', price: 10, category_id: '00000000-0000-0000-0000-000000000000' })
      expect(res.status).toBe(403)
    })
  })

  describe('Role-specific access', () => {
    it('should allow waiter to create orders', async () => {
      const menuItem = await pool.query(`SELECT id FROM menu_items LIMIT 1`)
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          order_type: 'PARCEL',
          order_source: 'WAITER',
          items: [{ menu_item_id: menuItem.rows[0].id, quantity: 1 }],
        })
      expect(res.status).toBe(201)
    })

    it('should allow waiter to list orders', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
      expect(res.status).toBe(200)
    })

    it('should allow kitchen to list orders', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${kitchenToken}`)
      expect(res.status).toBe(200)
    })
  })
})
