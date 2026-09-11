"use client"

import React, { useState, useEffect } from "react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import {
  Sliders,
  User,
  CheckSquare,
  Lock,
  Brain,
  Search,
  Compass,
  Bot,
  Wrench,
  CheckCircle2,
  FileText,
  Zap,
  Terminal,
  MessageSquare,
  Copy,
  Link as LinkIcon,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { TraceData } from "@/app/api/inspector/route"

export default function InspectorPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Sync isSidebarCollapsed with localStorage to avoid layout shifts
  useEffect(() => {
    const val = localStorage.getItem("isSidebarCollapsed")
    if (val !== null) {
      setIsSidebarCollapsed(val === "true")
    }
  }, [])

  const handleToggleCollapse = () => {
    const nextVal = !isSidebarCollapsed
    setIsSidebarCollapsed(nextVal)
    localStorage.setItem("isSidebarCollapsed", String(nextVal))
  }

  const [traceIdInput, setTraceIdInput] = useState("")
  const [traceData, setTraceData] = useState<TraceData | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [recentTraces, setRecentTraces] = useState<any[]>([])

  const fetchRecentTraces = async () => {
    try {
      const res = await fetch("/api/conversations")
      const data = await res.json()
      if (data.success && data.data && data.data.length > 0) {
        setRecentTraces(data.data)
        const firstId = data.data[0]._id
        setTraceIdInput(firstId)
        fetchTrace(firstId)
      } else {
        setRecentTraces([])
        setTraceData(null)
      }
    } catch (err) {
      console.error("Failed to load recent traces:", err)
    }
  }

  const fetchTrace = async (id: string) => {
    if (!id) return
    setIsLoading(true)
    setErrorBanner(null)
    try {
      const res = await fetch(`/api/inspector?traceId=${id}`)
      const data = await res.json()
      if (res.status === 404) {
        setTraceData(null)
        setErrorBanner(data.message || `The requested trace ID '${id}' is invalid.`)
      } else if (data.success) {
        setTraceData(data.data)
      } else {
        setTraceData(null)
        setErrorBanner("An error occurred while loading trace diagnostics.")
      }
    } catch (err) {
      console.error("Failed to query trace:", err)
      setTraceData(null)
      setErrorBanner("Diagnostics search failed. Connection offline.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentTraces()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!traceIdInput.trim()) return
    fetchTrace(traceIdInput.trim())
  }

  const handleCopy = () => {
    if (!traceData) return
    navigator.clipboard.writeText(traceData.query)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const getStepIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes("user")) return <User size={12} />
    if (n.includes("validation")) return <CheckSquare size={12} />
    if (n.includes("security") || n.includes("injection")) return <Lock size={12} />
    if (n.includes("memory")) return <Brain size={12} />
    if (n.includes("rag") || n.includes("search")) return <Search size={12} />
    if (n.includes("routing") || n.includes("classifier")) return <Compass size={12} />
    if (n.includes("tool")) return <Wrench size={12} />
    return <Bot size={12} />
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      {/* Shared Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      {/* Main Page Layout Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Shared Header Component */}
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Content Container - Split Layout */}
        <div className="flex flex-col xl:flex-row flex-1 overflow-y-auto xl:overflow-hidden h-full">
          {/* Left Panel: Execution Lifecycle Timeline */}
          <aside className="w-full xl:w-[320px] bg-white border-b xl:border-b-0 xl:border-r border-outline-variant flex flex-col shrink-0 h-auto xl:h-full">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex-shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Sliders size={16} />
                <span>Execution Lifecycle</span>
              </h3>
              {isLoading && <RefreshCw className="animate-spin text-primary" size={14} />}
            </div>

            {/* Recent Traces Selection Dropdown */}
            {recentTraces.length > 0 && (
              <div className="px-4 pt-4 pb-2 border-b border-outline-variant/60 bg-surface-container-low/20">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5 block">
                  Select Active Chat
                </label>
                <select
                  value={traceIdInput}
                  onChange={(e) => {
                    setTraceIdInput(e.target.value)
                    fetchTrace(e.target.value)
                  }}
                  className="w-full text-xs border border-outline-variant rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none bg-white text-on-surface font-medium"
                >
                  {recentTraces.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t._id.substring(0, 6)}...)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Search Panel */}
            <form onSubmit={handleSearchSubmit} className="p-4 border-b border-outline-variant bg-surface-container-low/10 flex gap-2">
              <input
                type="text"
                value={traceIdInput}
                onChange={(e) => setTraceIdInput(e.target.value)}
                placeholder="Mongoose Conversation ID"
                className="flex-1 text-xs border border-outline-variant rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
              />
              <button
                type="submit"
                className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary/95 font-semibold transition-colors active:scale-95"
              >
                Search
              </button>
            </form>

            <div className="p-6 space-y-6 overflow-y-visible xl:overflow-y-auto custom-scrollbar flex-1">
              {traceData?.steps.map((step, idx) => (
                <div key={idx} className="timeline-item relative flex gap-4 timeline-line">
                  <div className="w-6 h-6 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center z-10 shrink-0 text-on-surface-variant">
                    {getStepIcon(step.name)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-on-surface">{step.name}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container-low px-1.5 py-0.5 rounded">
                        {step.duration}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                      {step.details}
                    </p>
                  </div>
                </div>
              ))}

              {traceData && (
                <div className="timeline-item relative flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 shrink-0">
                    <CheckCircle2 className="text-white" size={12} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-on-surface">Completed</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                      Diagnostics trace loaded completely.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Center Content: Debugging Interface */}
          <section className="flex-1 bg-[#FAF7F2] p-4 md:p-6 h-auto xl:h-full xl:overflow-y-auto custom-scrollbar">
            <div className="max-w-[1200px] mx-auto space-y-6 h-full flex flex-col justify-between">
              
              {/* Invalid Search Warning Banner */}
              {errorBanner && (
                <div className="bg-red-50 text-red-800 border border-red-200 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fadeIn">
                  <AlertTriangle size={20} className="shrink-0 text-red-600" />
                  <div className="text-xs font-semibold">{errorBanner}</div>
                </div>
              )}

              {traceData ? (
                <div className="space-y-6">
                  {/* Top: Summary Panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
                    <div className="bg-white border border-outline-variant p-4 rounded-xl flex flex-col justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Trace ID</span>
                      <span className="font-mono text-xs font-bold text-primary truncate" title={traceData.traceId}>{traceData.traceId}</span>
                    </div>
                    <div className="bg-white border border-outline-variant p-4 rounded-xl flex flex-col justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Duration</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-lg font-bold text-on-surface">{traceData.latency}</span>
                      </div>
                    </div>
                    <div className="bg-white border border-outline-variant p-4 rounded-xl flex flex-col justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Final Status</span>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-sm font-bold text-on-surface">Success</span>
                      </div>
                    </div>
                    <div className="bg-white border border-outline-variant p-4 rounded-xl flex flex-col justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Active Model</span>
                      <span className="font-mono text-xs font-bold text-on-surface truncate" title={traceData.modelSelected}>{traceData.modelSelected}</span>
                    </div>
                  </div>

                  {/* Middle: RAG & Routing */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                    {/* RAG Panel */}
                    <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                      <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <FileText className="text-primary" size={16} />
                          <span>RAG Retrieval Context</span>
                        </h3>
                        <span className="font-mono text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                          {traceData.ragMatches.length} Documents Retrieved
                        </span>
                      </div>
                      <div className="p-4 space-y-4">
                        {traceData.ragMatches.map((match, mIdx) => (
                          <div key={mIdx} className="p-3.5 border border-outline-variant rounded-lg bg-surface-container-low/10">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2 text-primary">
                                <FileText size={16} />
                                <span className="text-xs font-bold text-on-surface truncate max-w-[150px]">{match.source}</span>
                              </div>
                              <span className="font-mono text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded font-bold">
                                Score: {match.score.toFixed(3)}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant italic leading-relaxed">
                              &quot;{match.content.substring(0, 160)}...&quot;
                            </p>
                          </div>
                        ))}
                        {traceData.ragMatches.length === 0 && (
                          <p className="text-xs text-on-surface-variant italic p-4 text-center">No document context retrieved for this trace.</p>
                        )}
                      </div>
                    </div>

                    {/* Routing Panel */}
                    <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                      <div className="p-4 border-b border-outline-variant bg-surface-container-low/30">
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <Compass className="text-primary" size={16} />
                          <span>Model Routing Logic</span>
                        </h3>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                          <div>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Provider</p>
                            <p className="text-sm font-bold text-on-surface">LangChain Hub Router</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Target Engine</p>
                            <p className="font-mono text-xs text-on-surface truncate" title={traceData.modelSelected}>{traceData.modelSelected}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Routing Reason</p>
                            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-primary">
                              <Zap size={18} className="flex-shrink-0 mt-0.5" />
                              <p className="text-xs leading-relaxed font-semibold">
                                System routing engine classified query complexity. High parameter token distribution routed to {traceData.modelSelected}.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Agent Actions & Response */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-body-sm animate-fadeIn">
                    {/* Agent Actions */}
                    <div className="lg:col-span-1 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-4 border-b border-outline-variant bg-surface-container-low/30">
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <Terminal className="text-primary" size={16} />
                          <span>Agent Diagnostics</span>
                        </h3>
                      </div>
                      <div className="p-4 space-y-4 flex-1">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                              <span className="font-bold text-on-surface">Standard Output stdout</span>
                            </div>
                          </div>
                          <div className="bg-inverse-surface p-3 rounded-lg overflow-x-auto">
                            <pre className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed">
                              <code>{traceData.toolStdout}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Response Panel */}
                    <div className="lg:col-span-2 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <MessageSquare className="text-primary" size={16} />
                          <span>User Query & Diagnostics</span>
                        </h3>
                        <button
                          onClick={handleCopy}
                          className="text-primary hover:bg-primary/5 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                          title="Copy query"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                        <div className="prose max-w-none text-on-surface-variant text-sm md:text-base leading-relaxed space-y-4">
                          <p className="font-semibold text-on-surface">Query Analyzed:</p>
                          <p className="italic bg-surface-container-low/50 p-3 rounded-lg border border-outline-variant">
                            &quot;{traceData.query}&quot;
                          </p>
                          <p>
                            Telemetry reports cost totals of <strong>{traceData.cost}</strong> for this run cycle.
                          </p>
                        </div>

                        <div className="mt-8 border-t border-outline-variant pt-6">
                          <div className="flex items-center gap-2 mb-4 text-on-surface-variant">
                            <LinkIcon size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">References Map</span>
                          </div>
                          <div className="flex flex-wrap gap-2.5">
                            {traceData.ragMatches.map((match, mIdx) => (
                              <button key={mIdx} className="flex items-center gap-2 px-3.5 py-1.5 border border-outline-variant rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
                                <BookOpen size={12} className="text-primary" />
                                <span>{match.source.split(/[\\/]/).pop()}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state when no conversations exist */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-outline-variant rounded-2xl shadow-sm text-center my-auto min-h-[300px]">
                  <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-2">No Conversation Diagnostics Loaded</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed mb-6">
                    Diagnostics database is empty or no conversation has been selected. Start a support chat on the homepage to inspect execution trace steps.
                  </p>
                </div>
              )}

            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
