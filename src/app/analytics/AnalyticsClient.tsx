"use client"

import React, { useState, useEffect } from "react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import {
  TrendingUp,
  Activity,
  Clock,
  Coins,
  DollarSign,
  CheckCircle2,
  AlertOctagon,
  Cpu,
  ArrowUpRight,
  Shield,
  LifeBuoy,
  MessageSquare,
  Wrench,
  FileText,
  AlertTriangle,
  Server,
  Cloud,
  Database,
  BarChart3,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { KPIStats, AnalyticsTrend, APILogItem } from "@/app/api/analytics/route"

export default function AnalyticsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [kpis, setKpis] = useState<KPIStats | null>(null)
  const [trends, setTrends] = useState<AnalyticsTrend | null>(null)
  const [logs, setLogs] = useState<APILogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  // Fetch telemetry logs from endpoint on mount
  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/analytics")
      const data = await res.json()
      if (data.success) {
        setKpis(data.kpis)
        setTrends(data.trends)
        const cappedLogs = (data.logs || []).slice(0, 50)
        setLogs(cappedLogs)
      }
    } catch (err) {
      console.error("Failed to load analytics telemetry:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTelemetry()
    const timer = setInterval(fetchTelemetry, 8000)
    return () => clearInterval(timer)
  }, [])

  // Calculate max trend value for dynamic chart scaling
  const maxTrendVal = trends && trends.tokens ? Math.max(...trends.tokens, 100) : 100

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

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-headline-lg font-bold text-on-surface">Analytics Overview</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Real-time operational metrics, token ingestion limits, and system health status.
                </p>
              </div>
              {isLoading && <RefreshCw className="animate-spin text-primary" size={18} />}
            </div>

            {kpis && trends ? (
              <>
                {/* KPI Grid */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* KPI Card 1 */}
                  <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Total Tokens</p>
                    <div className="flex items-end justify-between mt-3">
                      <h3 className="text-xl md:text-2xl font-bold font-mono text-on-surface">
                        {kpis.totalTokens.toLocaleString()}
                      </h3>
                      <span className="text-emerald-700 text-[10px] font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                  </div>

                  {/* KPI Card 2 */}
                  <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Active Sessions</p>
                    <div className="flex items-end justify-between mt-3">
                      <h3 className="text-xl md:text-2xl font-bold font-mono text-secondary">
                        {kpis.activeUsers}
                      </h3>
                      <span className="text-secondary text-[10px] font-bold bg-secondary-fixed px-2 py-0.5 rounded-full">Peak</span>
                    </div>
                  </div>

                  {/* KPI Card 3 */}
                  <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Avg Latency</p>
                    <div className="flex items-end justify-between mt-3">
                      <h3 className="text-xl md:text-2xl font-bold font-mono text-on-surface">
                        {kpis.avgLatency}ms
                      </h3>
                      <span className="text-primary text-[10px] font-bold bg-primary-fixed px-2 py-0.5 rounded-full">Optimal</span>
                    </div>
                  </div>

                  {/* KPI Card 5 */}
                  <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Real-Time API Cost</p>
                    <div className="flex items-end justify-between mt-3">
                      <h3 className="text-xl md:text-2xl font-bold font-mono text-primary">
                        ${kpis.cost.toFixed(5)}
                      </h3>
                      <TrendingUp className="text-primary" size={18} />
                    </div>
                  </div>
                </section>

                {/* Row 1: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Bar Chart */}
                  <div className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm flex flex-col min-h-[320px]">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-headline-md text-base font-bold text-on-surface">Daily Ingestion Trends</h4>
                      <span className="text-xs text-on-surface-variant">Last 7 chat sessions</span>
                    </div>
                    <div className="flex-1 chart-grid relative flex items-end gap-3 pb-6 px-2 min-h-[160px]">
                      {trends.tokens.map((val, idx) => {
                        const heightPct = Math.max(15, Math.round((val / maxTrendVal) * 100))
                        return (
                          <div
                            key={idx}
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-primary rounded-t opacity-75 hover:opacity-100 transition-all cursor-pointer relative group flex justify-center"
                            title={`${val} tokens`}
                          >
                            <span className="absolute -top-6 bg-neutral-950 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Token Trend SVG Area Chart */}
                  <div className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm flex flex-col min-h-[320px]">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-headline-md text-base font-bold text-on-surface">Token Usage Trend</h4>
                      <span className="text-xs text-on-surface-variant">Real-Time Ingestion</span>
                    </div>
                    <div className="flex-1 chart-grid relative overflow-hidden rounded-lg min-h-[160px] bg-[#FAF7F2] border border-outline-variant/65 flex items-center justify-center p-4">
                      {trends.tokens.length > 0 ? (
                        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 150">
                          <path
                            d={`M0,150 L0,${150 - (trends.tokens[0] || 0) / maxTrendVal * 120} C100,100 200,80 300,50 L400,20 L400,150 Z`}
                            fill="url(#grad1)"
                          ></path>
                          <path
                            d={`M0,${150 - (trends.tokens[0] || 0) / maxTrendVal * 120} C100,100 200,80 300,50 L400,20`}
                            fill="none"
                            stroke="#005c55"
                            strokeWidth="2.5"
                          ></path>
                          <defs>
                            <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: "#005c55", stopOpacity: 0.25 }}></stop>
                              <stop offset="100%" style={{ stopColor: "#005c55", stopOpacity: 0 }}></stop>
                            </linearGradient>
                          </defs>
                        </svg>
                      ) : (
                        <p className="text-xs text-on-surface-variant italic">No data recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Model Distribution & Latency */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Donut Chart */}
                  <div className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm flex flex-col min-h-[320px]">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-headline-md text-base font-bold text-on-surface">API Model Distribution</h4>
                    </div>
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
                      <div className="relative w-44 h-44 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" fill="transparent" r="16" stroke="#E5E7EB" strokeWidth="3"></circle>
                          <circle cx="18" cy="18" fill="transparent" r="16" stroke="#005c55" strokeDasharray={`${trends.models.gpt4} 100`} strokeWidth="3"></circle>
                          <circle cx="18" cy="18" fill="transparent" r="16" stroke="#9b4500" strokeDasharray={`${trends.models.gemini} 100`} strokeDashoffset={`-${trends.models.gpt4}`} strokeWidth="3"></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">GPT-4o</span>
                          <span className="text-xl font-extrabold text-on-surface">{trends.models.gpt4}%</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                          <span className="text-sm text-on-surface font-medium">GPT-4o Premium ({trends.models.gpt4}%)</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full bg-[#9b4500] inline-block"></span>
                          <span className="text-sm text-on-surface font-medium">Gemini Fallback ({trends.models.gemini}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scatter Plot Response Latency */}
                  <div className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm flex flex-col min-h-[320px]">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-headline-md text-base font-bold text-on-surface">Response Latency</h4>
                      <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Avg: {kpis.avgLatency}ms</span>
                    </div>
                    <div className="flex-1 chart-grid relative p-4 border border-outline-variant rounded-lg bg-[#FAF7F2] min-h-[160px]">
                      <div className="absolute h-px w-full bg-red-400 border-dashed opacity-45 top-1/2 left-0"></div>
                      <div className="flex items-center justify-around h-full">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-50 mb-10 transform hover:scale-125 transition-transform cursor-pointer"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-80 mb-2 transform hover:scale-125 transition-transform cursor-pointer"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mb-4 transform hover:scale-125 transition-transform cursor-pointer"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#9b4500] mb-12 transform hover:scale-125 transition-transform cursor-pointer"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-40 mb-8 transform hover:scale-125 transition-transform cursor-pointer"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-90 mb-16 transform hover:scale-125 transition-transform cursor-pointer"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Model Usage Table */}
                <section className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-outline-variant">
                    <h4 className="font-headline-md text-base font-bold text-on-surface">AI Model Usage</h4>
                  </div>
                  <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="bg-surface-container-low text-on-surface-variant font-semibold text-xs uppercase tracking-wider border-b border-outline-variant">
                        <tr>
                          <th className="px-6 py-4">Provider</th>
                          <th className="px-6 py-4">Model</th>
                          <th className="px-6 py-4">Requests Ratio</th>
                          <th className="px-6 py-4">Avg Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant font-body-sm text-on-surface">
                        <tr className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-6 py-4 flex items-center gap-2.5 font-semibold">
                            <div className="w-6 h-6 rounded bg-[#74aa9c] flex items-center justify-center text-white text-[10px] font-bold">O</div>
                            <span>OpenAI</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">GPT-4o / GPT-4o-mini</td>
                          <td className="px-6 py-4 font-mono text-sm">{trends.models.gpt4}%</td>
                          <td className="px-6 py-4 font-mono text-sm">{kpis.avgLatency}ms</td>
                        </tr>
                        <tr className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-6 py-4 flex items-center gap-2.5 font-semibold">
                            <div className="w-6 h-6 rounded bg-[#9b4500] flex items-center justify-center text-white text-[10px] font-bold">G</div>
                            <span>Gemini</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">Gemini-1.5-flash / pro</td>
                          <td className="px-6 py-4 font-mono text-sm">{trends.models.gemini}%</td>
                          <td className="px-6 py-4 font-mono text-sm">{kpis.avgLatency + 120}ms</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* System Activity Feed */}
                <div className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm pb-12">
                  <h4 className="font-headline-md text-base font-bold text-on-surface mb-6">Recent Activity Logs</h4>
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-outline-variant last:border-b-0 last:pb-0">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center shrink-0 text-primary">
                          <MessageSquare size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-semibold text-on-surface">
                              {log.method} {log.path}
                            </p>
                            <span className="text-[10px] text-on-surface-variant font-mono">{log.time}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Status: <span className="font-semibold text-primary">{log.status}</span> | Latency: {log.latency} | Cost: {log.cost}
                          </p>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-xs text-on-surface-variant text-center py-4">No recent activity logged.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Empty state if no data exists */
              <div className="flex flex-col items-center justify-center p-8 bg-white border border-outline-variant rounded-2xl shadow-sm text-center min-h-[300px]">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4 animate-bounce">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-base font-bold text-on-surface mb-2">No Ingested Analytics Found</h3>
                <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed mb-6">
                  Diagnostics database is currently empty. Start a conversation session on the homepage to register active telemetry metrics.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
