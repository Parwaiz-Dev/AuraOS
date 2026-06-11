import { reportApi, getErrorMessage } from './api'

interface DashboardMetrics {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalRevenue: number
  occupiedTables: number
  averageOrderValue: number
  averageOrderTime: number
}

interface Trends {
  orders: { date: string; count: number }[]
  revenue: { date: string; amount: number }[]
  topItems: { name: string; quantity: number; revenue: number }[]
}

interface Alert {
  id: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high'
  type: string
  timestamp: string
  read: boolean
}

export const reportService = {
  async getDashboard(params?: any) {
    try {
      const response = await reportApi.getDashboard(params)
      return response.data.data as DashboardMetrics
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getTrends(params?: any) {
    try {
      const response = await reportApi.getTrends(params)
      return response.data.data as Trends
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getAlerts() {
    try {
      const response = await reportApi.getAlerts()
      return response.data.data as Alert[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
