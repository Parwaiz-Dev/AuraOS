import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { Order } from '../types/order'
import { Table } from '../types/table'
import { MenuItem, MenuCategory } from '../types/menu'
import { Payment } from '../types/payment'
import { InventoryItem } from '../types/inventory'

interface AppState {
  orders: Order[]
  tables: Table[]
  menuItems: MenuItem[]
  menuCategories: MenuCategory[]
  payments: Payment[]
  inventory: InventoryItem[]
  loading: boolean
  error: string | null
}

type AppAction =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SET_TABLES'; payload: Table[] }
  | { type: 'UPDATE_TABLE'; payload: Table }
  | { type: 'SET_MENU_ITEMS'; payload: MenuItem[] }
  | { type: 'SET_MENU_CATEGORIES'; payload: MenuCategory[] }
  | { type: 'SET_PAYMENTS'; payload: Payment[] }
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'UPDATE_INVENTORY'; payload: InventoryItem }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }

const initialState: AppState = {
  orders: [],
  tables: [],
  menuItems: [],
  menuCategories: [],
  payments: [],
  inventory: [],
  loading: false,
  error: null
}

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload }
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders] }
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o)
      }
    case 'DELETE_ORDER':
      return { ...state, orders: state.orders.filter(o => o.id !== action.payload) }
    case 'SET_TABLES':
      return { ...state, tables: action.payload }
    case 'UPDATE_TABLE':
      return {
        ...state,
        tables: state.tables.map(t => t.id === action.payload.id ? action.payload : t)
      }
    case 'SET_MENU_ITEMS':
      return { ...state, menuItems: action.payload }
    case 'SET_MENU_CATEGORIES':
      return { ...state, menuCategories: action.payload }
    case 'SET_PAYMENTS':
      return { ...state, payments: action.payload }
    case 'ADD_PAYMENT':
      return { ...state, payments: [action.payload, ...state.payments] }
    case 'SET_INVENTORY':
      return { ...state, inventory: action.payload }
    case 'UPDATE_INVENTORY':
      return {
        ...state,
        inventory: state.inventory.map(i => i.id === action.payload.id ? action.payload : i)
      }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const useAppStore = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppStoreProvider')
  }
  return context
}

interface AppStoreProviderProps {
  children: ReactNode
}

export const AppStoreProvider: React.FC<AppStoreProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (initial) => {
    const stored = localStorage.getItem('appState')
    return stored ? JSON.parse(stored) : initial
  })

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify(state))
  }, [state])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}
