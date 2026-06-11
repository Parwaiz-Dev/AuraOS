// API Base Configuration and Authentication
import axios, { AxiosError } from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let logoutHandler: (() => void) | null = null

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

export const setLogoutHandler = (handler: () => void) => {
  logoutHandler = handler
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('[API] Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.debug(`[API] Response: ${response.status}`)
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (error.response?.status === 401) {
      console.warn('[API] Unauthorized - logging out')
      logoutHandler?.()
      return Promise.reject(error)
    }

    if (error.response?.status === 403) {
      console.warn('[API] Forbidden')
      return Promise.reject(error)
    }

    if (error.response?.status === 404) {
      console.warn('[API] Not found')
      return Promise.reject(error)
    }

    if (error.response?.status && error.response.status >= 500) {
      if (!originalRequest._retry) {
        originalRequest._retry = true
        console.warn('[API] Server error - retrying...')
        return api(originalRequest)
      }
    }

    console.error('[API] Error:', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    })

    return Promise.reject(error)
  }
)

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    message: string
    code?: string
  }
}

export const getErrorMessage = (error: any): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any
    return data?.error?.message || error.message || 'An error occurred'
  }
  return String(error) || 'An unknown error occurred'
}

// ============ AUTH SERVICES ============
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/login', { email, password }),
  
  register: (data: { email: string; password: string; name: string }) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/register', data),
  
  refresh: () =>
    api.post<ApiResponse<{ token: string }>>('/auth/refresh', {}),
  
  logout: () =>
    api.post('/auth/logout', {}),
  
  me: () =>
    api.get('/auth/me'),
}

// ============ RESTAURANT SERVICES ============
export const restaurantApi = {
  getRestaurant: () =>
    api.get('/restaurants/me'),
  
  getStats: () =>
    api.get('/restaurants/me/stats'),
}

// ============ TABLE SERVICES ============
export const tableApi = {
  list: (params?: any) =>
    api.get('/tables', { params }),
  
  create: (data: any) =>
    api.post('/tables', data),
  
  update: (id: string, data: any) =>
    api.patch(`/tables/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/tables/${id}`),
  
  getStats: () =>
    api.get('/tables/stats'),

  release: (id: string) =>
    api.patch(`/tables/${id}`, { status: 'AVAILABLE' }),
}

// ============ MENU SERVICES ============
export const menuApi = {
  getCategories: () =>
    api.get('/menu/categories'),
  
  getItems: (params?: any) =>
    api.get('/menu/items', { params }),
  
  createItem: (data: any) =>
    api.post('/menu/items', data),
  
  updateItem: (id: string, data: any) =>
    api.patch(`/menu/items/${id}`, data),
  
  deleteItem: (id: string) =>
    api.delete(`/menu/items/${id}`),
}

// ============ ORDER SERVICES ============
export const orderApi = {
  list: (params?: any) =>
    api.get('/orders', { params }),
  
  create: (data: any) =>
    api.post('/orders', data),
  
  update: (id: string, data: any) =>
    api.patch(`/orders/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/orders/${id}`),
  
  getDetail: (id: string) =>
    api.get(`/orders/${id}`),
  
  getStats: () =>
    api.get('/orders/stats'),

  changeStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}`, { status }),
}

// ============ PAYMENT SERVICES ============
export const paymentApi = {
  list: (params?: any) =>
    api.get('/payments', { params }),
  
  create: (data: any) =>
    api.post('/payments', data),
  
  update: (id: string, data: any) =>
    api.patch(`/payments/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/payments/${id}`),
  
  getDetail: (id: string) =>
    api.get(`/payments/${id}`),
}

// ============ INVENTORY SERVICES ============
export const inventoryApi = {
  list: (params?: any) =>
    api.get('/inventory', { params }),
  
  update: (id: string, data: any) =>
    api.patch(`/inventory/${id}`, data),
  
  getAlerts: () =>
    api.get('/inventory/alerts'),
}

// ============ REPORTS SERVICES ============
export const reportApi = {
  getDashboard: (params?: any) =>
    api.get('/reports/dashboard', { params }),
  
  getTrends: (params?: any) =>
    api.get('/reports/trends', { params }),
  
  getAlerts: () =>
    api.get('/reports/alerts'),
}

// ============ USER SERVICES ============
export const userApi = {
  list: (params?: any) =>
    api.get('/users', { params }),
  
  create: (data: any) =>
    api.post('/users', data),
  
  update: (id: string, data: any) =>
    api.patch(`/users/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/users/${id}`),
  
  changePassword: (id: string, newPassword: string) =>
    api.patch(`/users/${id}/password`, { newPassword }),
}

// ============ SUBSCRIPTION & BILLING SERVICES ============
export const subscriptionApi = {
  // Current restaurant's subscription (enriched view)
  getMine: () =>
    api.get('/subscriptions/me'),

  // Active plans catalogue
  getPlans: () =>
    api.get('/subscription-plans'),

  // Switch plan (ADMIN)
  changePlan: (planId: string) =>
    api.post('/subscriptions/change-plan', { plan_id: planId }),

  // Invoices for own restaurant
  getInvoices: (params?: any) =>
    api.get('/invoices', { params }),

  createInvoice: (data: { amount: number; due_date?: string; notes?: string; status?: string }) =>
    api.post('/invoices', data),

  markInvoicePaid: (id: string) =>
    api.post(`/invoices/${id}/mark-paid`, {}),

  // Super-admin only
  getPlatformMetrics: () =>
    api.get('/subscriptions/platform-metrics'),

  getAllRestaurants: (params?: { search?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/subscriptions/all-restaurants', { params }),

  adminSuspend: (restaurantId: string) =>
    api.post(`/subscriptions/admin/suspend/${restaurantId}`, {}),

  adminActivate: (restaurantId: string, planId?: string) =>
    api.post(`/subscriptions/admin/activate/${restaurantId}`, { plan_id: planId }),

  adminGenerateInvoice: (restaurantId: string, amount: number, notes?: string) =>
    api.post(`/subscriptions/admin/generate-invoice/${restaurantId}`, { amount, notes }),

  adminMarkInvoicePaid: (id: string) =>
    api.post(`/subscriptions/invoices/${id}/mark-paid`, {}),
}

export default api
