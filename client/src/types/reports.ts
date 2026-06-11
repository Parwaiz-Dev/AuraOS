export interface ReportFilters {
  startDate?: string
  endDate?: string
  restaurantId?: string
  status?: string
}

export interface DashboardStats {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalRevenue: number
  occupiedTables: number
  averageOrderValue: number
}

export interface OrderTrend {
  date: string
  count: number
  revenue: number
}

export interface TopItem {
  id: string
  name: string
  quantity: number
  revenue: number
}

export interface SalesReport {
  period: string
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  ordersByStatus: Record<string, number>
  ordersByType: Record<string, number>
  ordersBySource: Record<string, number>
  topItems: TopItem[]
  trends: OrderTrend[]
}

export interface RevenueBreakdown {
  date: string
  revenue: number
  orderCount: number
  method: string
}

export interface OrderBreakdown {
  type: string
  count: number
  percentage: number
  revenue: number
}

export interface TimeSeriesData {
  label: string
  value: number
}

export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
  }>
}
