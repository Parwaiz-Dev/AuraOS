export interface DailyRevenue {
  date: string
  revenue: number
  order_count: number
  average_order_value: number
}

export interface WeeklyRevenue {
  week_start: string
  week_end: string
  revenue: number
  order_count: number
  growth_percentage: number | null
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  order_count: number
  growth_percentage: number | null
}

export interface ForecastPoint {
  date: string
  predicted_revenue?: number
  predicted_orders?: number
  lower_bound: number
  upper_bound: number
}

export interface ForecastResponse {
  forecast: ForecastPoint[]
  confidence: number
  model_version: string
  generated_at: string
}

export interface CustomerSegment {
  customerId: string
  name: string
  segment: 'VIP' | 'Loyal' | 'Regular' | 'At Risk' | 'Lost'
  recencyDays: number
  frequency: number
  monetary: number
  totalSpent: number
}

export interface Recommendation {
  menu_item_id: string
  name: string
  category: string
  price: number
  reason: string
  score: number
}

export interface WaitTimeEstimate {
  estimated_prep_minutes: number
  estimated_delivery_minutes?: number
  kitchen_load: number
  confidence: number
}

export interface InventoryPrediction {
  menu_item_id: string
  name: string
  current_stock: number
  predicted_usage_next_7d: number
  days_until_stockout: number | null
  reorder_recommendation: string
}

export interface DashboardKPI {
  total_revenue: number
  total_orders: number
  average_order_value: number
  revenue_growth: number
  order_growth: number
}

export interface SalesChart {
  labels: string[]
  data: number[]
}

export interface TopItem {
  menu_item_id: string
  name: string
  category: string
  total_sold: number
  total_revenue: number
  rank: number
}

export interface DashboardData {
  kpis: DashboardKPI
  hourly_sales: SalesChart
  weekly_sales: SalesChart
  monthly_sales: SalesChart
  top_items: TopItem[]
  generated_at: string
}

export interface ChatRequest {
  message: string
}

export interface ChatExplanation {
  reasons: string[]
  trends: string[]
  recommendations: string[]
  summary: string
}

export interface ChatResponse {
  answer: string
  sources: string[]
  confidence: number
  explanation?: ChatExplanation
  intent: string
  provider: string
  response_time_ms: number
}

export interface CopilotStats {
  questionsAnswered: number
  averageResponseTime: number
  provider: string
}

export interface InsightAnomaly {
  metric: string
  value: number
  expected: number
  deviation: number
  severity: string
  description: string
}

export interface InsightTrend {
  metric: string
  direction: string
  change: number
  period: string
  description: string
}

export interface InsightOpportunity {
  title: string
  description: string
  expected_impact: string
  confidence: number
}

export interface InsightRisk {
  title: string
  description: string
  severity: string
  mitigation: string
}

export interface InsightResponse {
  restaurant_id: string
  generated_at: string
  summary: string
  anomalies: InsightAnomaly[]
  trends: InsightTrend[]
  opportunities: InsightOpportunity[]
  risks: InsightRisk[]
  counts: Record<string, number>
}

export interface WeeklyReportResponse extends InsightResponse {
  week_start: string
  week_end: string
}

export interface ModelHealthItem {
  status: string
  active_count: number
  failed_count: number
  total_versions: number
}

export interface ModelHealthResponse {
  models: Record<string, ModelHealthItem>
}

export interface ModelMetrics {
  totalModels: number
  healthyModels: number
  failedModels: number
  averageAccuracy: number
}

export interface EventItem {
  event_id: string
  event_name: string
  restaurant_id: string
  status: string
  created_at: string
  data?: Record<string, unknown>
}

export interface PaginatedEvents {
  items: EventItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface EventStats {
  total_events: number
  processed: number
  failed: number
  pending: number
  retries: number
  average_processing_time_ms: number
  throughput_per_minute: number
  event_types: Record<string, number>
  bus_total_published: number
  bus_total_processed: number
  bus_total_failed: number
  bus_total_retries: number
  dead_letter_count: number
}

export interface WorkflowDefinition {
  workflow_id: string
  name: string
  description: string
  steps: string[]
  category: string
}

export interface WorkflowStats {
  total_executions: number
  running: number
  completed: number
  failed: number
  average_duration_ms: number
}

export interface WorkflowExecution {
  execution_id: string
  workflow_id: string
  status: string
  started_at: string
  completed_at?: string
  duration_ms?: number
  steps_completed: number
  total_steps: number
  result?: Record<string, unknown>
  error?: string
}

export interface AutonomyStatus {
  enabled: boolean
  running_actions: number
  total_executions: number
  pending_approvals: number
  confidence_threshold: number
  risk_tolerance: string
}

export interface AutonomyAction {
  action_name: string
  description: string
  risk_level: string
  requires_approval: boolean
  last_run?: string
  run_count: number
}

export interface ApprovalRequest {
  request_id: string
  action_name: string
  description: string
  risk_level: string
  confidence: number
  parameters: Record<string, unknown>
  created_at: string
  restaurant_id: string
}

export interface AgentInfo {
  agent_id: string
  name: string
  role: string
  status: string
  current_task?: string
  memory_size?: number
  tasks_completed: number
  last_active?: string
}

export interface AgentMetrics {
  total_agents: number
  active_agents: number
  idle_agents: number
  failed_agents: number
  total_tasks_processed: number
  total_messages: number
  average_task_duration_ms: number
}

export interface RAGDocument {
  document_id: string
  filename: string
  document_type: string
  chunks: number
  uploaded_at?: string
}

export interface RAGSearchResult {
  chunk_id: string
  document_id: string
  document_type: string
  text: string
  score: number
  metadata?: Record<string, unknown>
}

export interface RAGSearchResponse {
  query: string
  results: RAGSearchResult[]
  total: number
  latency_ms: number
}

export interface RAGQueryResponse {
  question: string
  answer: string
  sources: Array<{
    document_id: string
    document_type: string
    chunk_id: string
    text: string
    confidence: number
  }>
  provider: string
  latency_ms: number
  token_usage?: Record<string, number>
}

export interface RAGStats {
  documents: number
  chunks: number
  queries_served: number
  average_latency_ms: number
  hit_rate: number
  provider: string
}

export interface SystemHealth {
  status: string
  components: Record<string, {
    status: string
    latency_ms?: number
    details?: Record<string, unknown>
  }>
  uptime_seconds: number
  last_check: string
}

export interface HealthMetrics {
  cpu_percent?: number
  memory_percent?: number
  disk_percent?: number
  response_time_ms?: number
  active_connections?: number
}
