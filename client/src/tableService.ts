import { tableApi, getErrorMessage } from './api'
import { Table } from './types/table'

export const tableService = {
  async getTables() {
    try {
      const response = await tableApi.list()
      return response.data.data as Table[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getTableById(id: string) {
    try {
      const response = await tableApi.list({ id })
      const tables = response.data.data as Table[]
      return tables.find(t => t.id === id)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async createTable(data: Partial<Table>) {
    try {
      const response = await tableApi.create(data)
      return response.data.data as Table
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async updateTable(id: string, data: Partial<Table>) {
    try {
      const response = await tableApi.update(id, data)
      return response.data.data as Table
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async deleteTable(id: string) {
    try {
      await tableApi.delete(id)
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getTableStats() {
    try {
      const response = await tableApi.getStats()
      return response.data.data
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async releaseTable(id: string) {
    try {
      const response = await tableApi.release(id)
      return response.data.data as Table
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
