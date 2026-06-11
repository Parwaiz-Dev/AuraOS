import { paymentApi, getErrorMessage } from './api'
import { Payment } from './types/payment'

export const paymentService = {
  async getPayments(filters?: any) {
    try {
      const response = await paymentApi.list(filters)
      return response.data.data as Payment[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getPaymentById(id: string) {
    try {
      const response = await paymentApi.getDetail(id)
      return response.data.data as Payment
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async createPayment(data: Partial<Payment>) {
    try {
      const response = await paymentApi.create(data)
      return response.data.data as Payment
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async updatePayment(id: string, data: Partial<Payment>) {
    try {
      const response = await paymentApi.update(id, data)
      return response.data.data as Payment
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async deletePayment(id: string) {
    try {
      await paymentApi.delete(id)
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
