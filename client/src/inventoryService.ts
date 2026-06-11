import { inventoryApi, getErrorMessage } from './api'

interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  minQuantity: number
  maxQuantity: number
  price: number
}

interface InventoryAlert {
  id: string
  itemId: string
  itemName: string
  message: string
  severity: 'low' | 'medium' | 'high'
  createdAt: string
}

export const inventoryService = {
  async getInventory() {
    try {
      const response = await inventoryApi.list()
      return response.data.data as InventoryItem[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async getInventoryAlerts() {
    try {
      const response = await inventoryApi.getAlerts()
      return response.data.data as InventoryAlert[]
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async updateInventoryItem(id: string, quantity: number) {
    try {
      const response = await inventoryApi.update(id, { quantity })
      return response.data.data as InventoryItem
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
