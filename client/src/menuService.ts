import { menuApi, getErrorMessage } from './api'
import { MenuItem } from './types/menu'

interface Category {
  id: string
  name: string
  description?: string
}

export const menuService = {
  async getCategories() {
    try {
      const response = await menuApi.getCategories()
      return response.data.data as Category[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getMenuItems(categoryId?: string) {
    try {
      const response = await menuApi.getItems({ categoryId })
      return response.data.data as MenuItem[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async createMenuItem(data: Partial<MenuItem>) {
    try {
      const response = await menuApi.createItem(data)
      return response.data.data as MenuItem
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async updateMenuItem(id: string, data: Partial<MenuItem>) {
    try {
      const response = await menuApi.updateItem(id, data)
      return response.data.data as MenuItem
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async deleteMenuItem(id: string) {
    try {
      await menuApi.deleteItem(id)
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
