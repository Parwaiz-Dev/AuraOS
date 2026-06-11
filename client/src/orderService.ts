import { orderApi, getErrorMessage } from './api'
import { Order, OrderStatus } from './types/order'

export const orderService = {
  async getOrders(filters?: { status?: OrderStatus; tableId?: string }) {
    try {
      const response = await orderApi.list({ ...filters })
      return response.data.data as Order[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getOrderById(id: string) {
    try {
      const response = await orderApi.getDetail(id)
      return response.data.data as Order
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async createOrder(data: Partial<Order>) {
    try {
      const response = await orderApi.create(data)
      return response.data.data as Order
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async updateOrder(id: string, data: Partial<Order>) {
    try {
      const response = await orderApi.update(id, data)
      return response.data.data as Order
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async deleteOrder(id: string) {
    try {
      await orderApi.delete(id)
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getOrderStats() {
    try {
      const response = await orderApi.getStats()
      return response.data.data
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async changeStatus(id: string, status: OrderStatus) {
    try {
      const response = await orderApi.changeStatus(id, status)
      return response.data.data as Order
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
