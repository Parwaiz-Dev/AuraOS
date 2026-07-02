import { useState, useRef, useCallback } from 'react'
import {
  DocumentTextIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  ChartBarIcon,
  ServerIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useAIQuery } from '../../hooks/useAIQuery'
import { aiRAGApi } from '../../services/aiApi'
import {
  AIStatCard,
  AIPageHeader,
  AIErrorState,
  AILoadingGrid,
  AIBadge,
  AITabButton,
  AIEmptyState,
} from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

type Tab = 'search' | 'ask' | 'upload'

interface RAGStats {
  documents: number
  chunks: number
  queries_served: number
  average_latency_ms: number
  hit_rate: number
  provider: string
}

interface SearchResult {
  chunk_id: string
  document_id: string
  document_type: string
  text: string
  score: number
  metadata: Record<string, unknown>
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
  latency_ms: number
}

interface Source {
  document_id: string
  document_type: string
  chunk_id: string
  text: string
  confidence: number
}

interface QueryResponse {
  question: string
  answer: string
  sources: Source[]
  provider: string
  latency_ms: number
  token_usage: number
}

interface UploadResponse {
  document_id: string
  chunks: number
  filename: string
  document_type: string
}

const ACCEPTED_TYPES = '.pdf,.txt,.md'

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

export default function AIKnowledgeBase() {
  const [tab, setTab] = useState<Tab>('search')

  // Stats
  const statsQuery = useAIQuery<RAGStats>(() => aiRAGApi.stats())
  const stats: RAGStats | null = (statsQuery.data as any)?.data ?? statsQuery.data

  // Search state
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Ask state
  const [questionInput, setQuestionInput] = useState('')
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null)
  const [askLoading, setAskLoading] = useState(false)

  // Upload state
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    const q = searchInput.trim()
    if (!q) return
    setSearchLoading(true)
    try {
      const res = await aiRAGApi.search(q, { top_k: 10 })
      setSearchResults(res.data?.data ?? res.data)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [searchInput])

  const handleAsk = useCallback(async () => {
    const q = questionInput.trim()
    if (!q) return
    setAskLoading(true)
    try {
      const res = await aiRAGApi.query(q, 5)
      setQueryResult(res.data?.data ?? res.data)
    } catch {
      toast.error('Query failed')
    } finally {
      setAskLoading(false)
    }
  }, [questionInput])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await aiRAGApi.upload(file)
      const result = res.data?.data ?? res.data
      setUploadResult(result)
      toast.success(`Uploaded "${result.filename}" successfully`)
      statsQuery.refetch()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [statsQuery.refetch])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  // Loading / error
  if (statsQuery.error && !stats) {
    return (
      <div className="p-6 space-y-6">
        <AIPageHeader title="Knowledge Base" subtitle="RAG-powered document intelligence" />
        <AIErrorState message={statsQuery.error} onRetry={statsQuery.refetch} />
      </div>
    )
  }

  if (statsQuery.loading && !stats) {
    return (
      <div className="p-6 space-y-6">
        <AIPageHeader title="Knowledge Base" subtitle="RAG-powered document intelligence" />
        <AILoadingGrid count={6} />
      </div>
    )
  }

  const statLoading = statsQuery.loading && !stats

  return (
    <div className="p-6 space-y-6">
      <AIPageHeader
        title="Knowledge Base"
        subtitle="RAG-powered document intelligence"
        actions={
          <button
            onClick={statsQuery.refetch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AIStatCard
          title="Documents"
          value={stats?.documents ?? 0}
          icon={DocumentTextIcon}
          color="blue"
          loading={statLoading}
        />
        <AIStatCard
          title="Chunks"
          value={stats?.chunks ?? 0}
          icon={CubeIcon}
          color="purple"
          loading={statLoading}
        />
        <AIStatCard
          title="Queries Served"
          value={stats?.queries_served ?? 0}
          icon={MagnifyingGlassIcon}
          color="indigo"
          loading={statLoading}
        />
        <AIStatCard
          title="Avg Latency"
          value={stats ? formatLatency(stats.average_latency_ms) : '--'}
          icon={ClockIcon}
          color="amber"
          loading={statLoading}
        />
        <AIStatCard
          title="Hit Rate"
          value={stats ? `${Math.round(stats.hit_rate * 100)}%` : '--'}
          icon={ChartBarIcon}
          color="green"
          loading={statLoading}
        />
        <AIStatCard
          title="Provider"
          value={stats?.provider ?? '--'}
          icon={ServerIcon}
          color="blue"
          loading={statLoading}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <AITabButton active={tab === 'search'} onClick={() => setTab('search')}>
          <MagnifyingGlassIcon className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Search
        </AITabButton>
        <AITabButton active={tab === 'ask'} onClick={() => setTab('ask')}>
          <SparklesIcon className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Ask AI
        </AITabButton>
        <AITabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
          <ArrowUpTrayIcon className="w-4 h-4 inline-block mr-1 -mt-0.5" />
          Upload
        </AITabButton>
      </div>

      {/* Search tab */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search documents..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading || !searchInput.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {searchLoading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="w-4 h-4" />
              )}
              Search
            </button>
          </div>

          {searchResults ? (
            searchResults.results.length === 0 ? (
              <AIEmptyState
                icon={MagnifyingGlassIcon}
                title="No results found"
                description={`No documents matched "${searchResults.query}". Try a different query.`}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} in {formatLatency(searchResults.latency_ms)}
                </p>
                {searchResults.results.map((r) => (
                  <div key={r.chunk_id} className="card p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <AIBadge label={r.document_type} variant="blue" />
                        <span className="text-xs text-slate-400 font-mono">{r.document_id.slice(0, 12)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3 line-clamp-4">{r.text}</p>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Similarity</p>
                      <ScoreBar score={r.score} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <AIEmptyState
              icon={MagnifyingGlassIcon}
              title="Search your knowledge base"
              description="Enter a query to find relevant document chunks using semantic search."
            />
          )}
        </div>
      )}

      {/* Ask AI tab */}
      {tab === 'ask' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask a question about your data..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
            />
            <button
              onClick={handleAsk}
              disabled={askLoading || !questionInput.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {askLoading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <SparklesIcon className="w-4 h-4" />
              )}
              Ask
            </button>
          </div>

          {askLoading && (
            <div className="card p-8 flex flex-col items-center justify-center gap-3">
              <ArrowPathIcon className="w-6 h-6 text-brand-500 animate-spin" />
              <p className="text-sm text-slate-500">Thinking...</p>
            </div>
          )}

          {queryResult && !askLoading && (
            <div className="space-y-4">
              {/* Answer */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-4 h-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Answer</h3>
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {queryResult.answer}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
                  <span>Provider: {queryResult.provider}</span>
                  <span>Latency: {formatLatency(queryResult.latency_ms)}</span>
                  <span>Tokens: {queryResult.token_usage}</span>
                </div>
              </div>

              {/* Sources */}
              {queryResult.sources.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Sources</h3>
                  <div className="space-y-3">
                    {queryResult.sources.map((src) => (
                      <div key={src.chunk_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1.5">
                          <AIBadge label={src.document_type} variant="purple" />
                          <span className="text-xs text-slate-400 font-mono">{src.document_id.slice(0, 12)}</span>
                          <span className="ml-auto text-xs font-medium text-slate-500">
                            {Math.round(src.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{src.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!queryResult && !askLoading && (
            <AIEmptyState
              icon={ChatBubbleBottomCenterTextIcon}
              title="Ask your knowledge base"
              description="Ask a natural language question and get AI-generated answers with source citations."
            />
          )}
        </div>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'card p-10 border-2 border-dashed cursor-pointer transition-colors text-center',
              dragOver
                ? 'border-brand-400 bg-brand-50/50'
                : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50/50',
              uploading && 'pointer-events-none opacity-60',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={onFileSelect}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <ArrowPathIcon className="w-10 h-10 text-brand-500 animate-spin" />
                <p className="text-sm font-medium text-slate-700">Uploading and processing...</p>
                <p className="text-xs text-slate-500">This may take a moment for large files</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <DocumentArrowUpIcon className="w-7 h-7 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Drop a file here or <span className="text-brand-600">click to browse</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Supported formats: PDF, TXT, MD</p>
                </div>
              </div>
            )}
          </div>

          {uploadResult && (
            <div className="card p-5 border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-900">Upload Successful</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Filename</p>
                  <p className="text-sm font-medium text-slate-800 truncate">{uploadResult.filename}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Document ID</p>
                  <p className="text-sm font-mono text-slate-700 truncate">{uploadResult.document_id}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Type</p>
                  <p className="text-sm font-medium text-slate-800">{uploadResult.document_type}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Chunks Created</p>
                  <p className="text-sm font-semibold text-slate-800">{uploadResult.chunks}</p>
                </div>
              </div>
            </div>
          )}

          {!uploadResult && !uploading && (
            <AIEmptyState
              icon={ArrowUpTrayIcon}
              title="Upload documents"
              description="Upload PDF, TXT, or MD files to expand your knowledge base. Documents are automatically chunked and indexed."
            />
          )}
        </div>
      )}
    </div>
  )
}
