import { useState, useRef, useEffect } from 'react'
import { aiCopilotApi } from '../../services/aiApi'
import { AIPageHeader } from '../../components/ai/AIShared'
import { cn } from '../../lib/utils'
import {
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
  sources?: string[]
  confidence?: number
  responseTime?: number
}

interface CopilotStats {
  questionsAnswered: number
  averageResponseTime: number
  provider: string
}

// ---------------------------------------------------------------------------
// Simple markdown renderer (regex-based, no extra dependencies)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  let html = text
    // Code blocks: ```...```
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<pre class="bg-slate-800 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-sm leading-relaxed"><code>${escaped}</code></pre>`
    })
    // Inline code: `...`
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-slate-100 text-brand-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>',
    )
    // Bold: **...**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic: *...*
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Unordered list items: - item or * item
    .replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered list items: 1. item
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br />')

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(
    /((?:<li[^>]*>.*?<\/li>(?:<br \/>)?)+)/g,
    '<ul class="my-1 space-y-0.5">$1</ul>',
  )
  // Clean stray <br /> inside <ul>
  html = html.replace(/<ul([^>]*)>([\s\S]*?)<\/ul>/g, (_m, attrs, inner) => {
    return `<ul${attrs}>${inner.replace(/<br \/>/g, '')}</ul>`
  })

  return html
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  'Show today\'s revenue',
  'Why did revenue decrease?',
  'Forecast tomorrow',
  'What should I promote?',
  'How is inventory?',
  'What\'s the average wait time?',
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
        <SparklesIcon className="w-4 h-4 text-brand-600" />
      </div>
      <div className="bg-brand-50 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const variant =
    pct >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : pct >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', variant)}>
      {pct}% confidence
    </span>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-start gap-3 max-w-3xl', isUser && 'ml-auto flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-brand-600' : 'bg-brand-100',
        )}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <SparklesIcon className="w-4 h-4 text-brand-600" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-brand-600 text-white rounded-tr-md'
              : 'bg-brand-50 text-slate-800 rounded-tl-md',
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div
              className="prose-sm max-w-none [&_pre]:my-2 [&_ul]:my-1 [&_li]:my-0"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
          )}
        </div>

        {/* Meta row for AI messages */}
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {message.confidence !== undefined && (
              <ConfidenceBadge confidence={message.confidence} />
            )}
            {message.responseTime !== undefined && (
              <span className="text-xs text-slate-400">
                {(message.responseTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 mt-0.5">
            <span className="text-xs text-slate-400">Sources:</span>
            {message.sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
              >
                {src}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AICopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<CopilotStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ---- Load stats on mount ------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        const res = await aiCopilotApi.stats()
        if (!cancelled) setStats(res.data.data ?? res.data)
      } catch {
        // Stats are non-critical; silently ignore
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [])

  // ---- Auto-scroll to bottom on new messages ------------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ---- Auto-resize textarea ----------------------------------------------
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
    }
  }, [input])

  // ---- Send message -------------------------------------------------------
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isLoading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await aiCopilotApi.chat(content)
      const data = res.data.data ?? res.data

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'ai',
        content: data.answer ?? data.explanation ?? 'I could not generate a response.',
        timestamp: new Date(),
        sources: data.sources,
        confidence: data.confidence,
        responseTime: data.response_time_ms,
      }

      setMessages((prev) => [...prev, aiMsg])

      // Refresh stats after each successful interaction
      try {
        const statsRes = await aiCopilotApi.stats()
        setStats(statsRes.data.data ?? statsRes.data)
      } catch {
        // Non-critical
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'ai',
        content:
          err?.response?.data?.detail ??
          'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  // ---- Keyboard handler ---------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ---- Render -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <AIPageHeader
        title="AI Copilot"
        subtitle="Ask questions about your restaurant performance in natural language"
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-6 w-24 bg-slate-200 rounded" />
            </div>
          ))
        ) : (
          <>
            <div className="card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-50">
                <SparklesIcon className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Questions Answered</p>
                <p className="text-lg font-bold text-slate-900">
                  {stats?.questionsAnswered ?? 0}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <ArrowPathIcon className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg Response Time</p>
                <p className="text-lg font-bold text-slate-900">
                  {stats?.averageResponseTime
                    ? `${(stats.averageResponseTime / 1000).toFixed(1)}s`
                    : '--'}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <SparklesIcon className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Provider</p>
                <p className="text-lg font-bold text-slate-900 truncate">
                  {stats?.provider ?? 'AI'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat area */}
      <div className="card flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 rounded-2xl bg-brand-50 mb-4">
                <SparklesIcon className="w-10 h-10 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                How can I help you today?
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md">
                Ask me anything about your restaurant -- revenue, orders, forecasts,
                inventory, and more.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="px-3 py-1.5 text-sm text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full border border-brand-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 px-4 py-3 bg-white">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your restaurant..."
              rows={1}
              disabled={isLoading}
              className={cn(
                'flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm',
                'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={cn(
                'flex-shrink-0 p-2.5 rounded-xl transition-colors',
                input.trim() && !isLoading
                  ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
