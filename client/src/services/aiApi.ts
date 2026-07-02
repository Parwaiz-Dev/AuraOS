import axios from 'axios'
import { setAuthToken as _syncToken } from '../api'

const aiApi = axios.create({
  baseURL: '/ai-api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

aiApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

aiApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('[AI API] Unauthorized')
    }
    if (error.response?.status && error.response.status >= 500 && !error.config._retry) {
      error.config._retry = true
      return aiApi(error.config)
    }
    return Promise.reject(error)
  },
)

export const aiDashboardApi = {
  get: () => aiApi.get('/dashboard'),
}

export const aiRevenueApi = {
  daily: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    aiApi.get('/analytics/revenue/daily', { params }),
  weekly: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    aiApi.get('/analytics/revenue/weekly', { params }),
  monthly: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    aiApi.get('/analytics/revenue/monthly', { params }),
  yearly: (params?: { limit?: number }) =>
    aiApi.get('/analytics/revenue/yearly', { params }),
  trends: (params?: { periods?: number }) =>
    aiApi.get('/analytics/revenue/trends', { params }),
  peakHours: (params?: { start_date?: string; end_date?: string }) =>
    aiApi.get('/analytics/revenue/peak-hours', { params }),
}

export const aiTopItemsApi = {
  topItems: (params?: { start_date?: string; end_date?: string; limit?: number; order_by?: string }) =>
    aiApi.get('/analytics/top-items', { params }),
  topCategories: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    aiApi.get('/analytics/top-categories', { params }),
  frequentlyBoughtTogether: (params?: { limit?: number }) =>
    aiApi.get('/analytics/frequently-bought-together', { params }),
}

export const aiForecastApi = {
  revenue: (days = 30) => aiApi.get('/forecast/revenue', { params: { days } }),
  orders: (days = 30) => aiApi.get('/forecast/orders', { params: { days } }),
}

export const aiCustomerApi = {
  segments: () => aiApi.get('/customers/segments'),
}

export const aiRecommendationApi = {
  items: (params?: { item_ids?: string; limit?: number }) =>
    aiApi.get('/recommendations/items', { params }),
}

export const aiPredictApi = {
  waitTime: () => aiApi.get('/predict/wait-time'),
  inventory: (params?: { item_ids?: string }) =>
    aiApi.get('/predict/inventory', { params }),
}

export const aiCopilotApi = {
  chat: (message: string) => aiApi.post('/copilot/chat', { message }),
  stats: () => aiApi.get('/copilot/stats'),
}

export const aiInsightsApi = {
  daily: () => aiApi.get('/insights/daily'),
  weekly: () => aiApi.get('/insights/weekly'),
  history: (params?: { limit?: number; restaurant_id?: string }) =>
    aiApi.get('/insights/history', { params }),
}

export const aiModelsApi = {
  health: () => aiApi.get('/models/health'),
  metrics: () => aiApi.get('/metrics/models'),
  retrain: (model: string) => aiApi.post('/models/retrain', { model }),
}

export const aiEventsApi = {
  list: (params?: { event_type?: string; status?: string; page?: number; page_size?: number }) =>
    aiApi.get('/events', { params }),
  stats: () => aiApi.get('/events/stats'),
  failed: (params?: { limit?: number }) => aiApi.get('/events/failed', { params }),
  history: (params?: { event_type?: string; start_date?: string; end_date?: string; page?: number; page_size?: number }) =>
    aiApi.get('/events/history', { params }),
  replay: (body: { event_id?: string; event_type?: string; replay_dlq?: boolean }) =>
    aiApi.post('/events/replay', body),
}

export const aiWorkflowApi = {
  list: () => aiApi.get('/workflows'),
  stats: () => aiApi.get('/workflows/stats'),
  history: (params?: { workflow_id?: string; status?: string; page?: number; page_size?: number }) =>
    aiApi.get('/workflows/history', { params }),
  get: (executionId: string) => aiApi.get(`/workflows/${executionId}`),
  run: (body: { workflow_id: string; metadata?: Record<string, unknown> }) =>
    aiApi.post('/workflows/run', body),
  cancel: (workflowId: string) => aiApi.post('/workflows/cancel', { workflow_id: workflowId }),
}

export const aiAutonomyApi = {
  status: () => aiApi.get('/autonomy/status'),
  actions: () => aiApi.get('/autonomy/actions'),
  history: (params?: { limit?: number }) => aiApi.get('/autonomy/history', { params }),
  pendingApprovals: () => aiApi.get('/autonomy/pending-approvals'),
  approve: (requestId: string) => aiApi.post('/autonomy/approve', { request_id: requestId }),
  reject: (requestId: string) => aiApi.post('/autonomy/reject', { request_id: requestId }),
  run: (body: { action_name: string; parameters?: Record<string, unknown> }) =>
    aiApi.post('/autonomy/run', body),
}

export const aiAgentsApi = {
  list: () => aiApi.get('/agents'),
  status: () => aiApi.get('/agents/status'),
  metrics: () => aiApi.get('/agents/metrics'),
  tasks: (params?: { limit?: number }) => aiApi.get('/agents/tasks', { params }),
  history: (params?: { limit?: number }) => aiApi.get('/agents/history', { params }),
  run: (request: string) => aiApi.post('/agents/run', { request }),
  restart: (agentId: string) => aiApi.post('/agents/restart', { agent_id: agentId }),
}

export const aiRAGApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return aiApi.post('/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
  search: (q: string, params?: { top_k?: number; document_type?: string }) =>
    aiApi.get('/rag/search', { params: { q, ...params } }),
  query: (question: string, top_k = 5) =>
    aiApi.post('/rag/query', { question, top_k }),
  stats: () => aiApi.get('/rag/stats'),
}

export const aiHealthApi = {
  system: () => aiApi.get('/health/system'),
  agents: () => aiApi.get('/health/agents'),
  workflows: () => aiApi.get('/health/workflows'),
  metrics: () => aiApi.get('/health/metrics'),
  anomalies: (params?: { limit?: number }) => aiApi.get('/health/anomalies', { params }),
  recovery: (params?: { limit?: number }) => aiApi.get('/health/recovery', { params }),
  recover: (component: string) => aiApi.post('/health/recover', { component }),
  replayDlq: () => aiApi.post('/health/replay-dlq'),
  check: () => aiApi.get('/health'),
}

export default aiApi
