"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Flame, FilePenLine, Loader2, Search } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { TrendingPromptModal } from "@/components/trending-topics/TrendingPromptModal"
import { ResearchProgress } from "@/components/trending-topics/ResearchProgress"
import { TrendingEmptyState, TrendingErrorState } from "@/components/trending-topics/StatusPanels"
import { TrendingResults } from "@/components/trending-topics/TrendingResults"
import { ResetButton } from "@/components/ui/ResetButton"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useTrendingTopicsSearch } from "@/hooks/useTrendingTopicsSearch"
import { TRENDING_ERROR_MESSAGE } from "@/constants/trending"

export default function TrendingTopicsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, stages, error, search, reset, loadSaved } = useTrendingTopicsSearch()
  const isLoading = status === "loading"

  // Everyone sees the latest saved topics: checked on arrival and whenever the tab comes back into view
  useEffect(() => {
    void loadSaved()
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSaved()
    }
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible)
  }, [loadSaved])

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6">
            {/* Page header & controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Flame size={24} className="text-secondary shrink-0" aria-hidden="true" />
                  Trending Topics
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Fresh, source-backed developments worth joining the conversation on LinkedIn.
                </p>
              </div>

              <div className="flex gap-2 sm:shrink-0">
                <ResetButton onReset={() => void reset()} disabled={status === "idle" || status === "checking"} />
                <button
                  type="button"
                  onClick={() => setIsPromptEditorOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
                <button
                  type="button"
                  onClick={() => void search()}
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Search size={16} aria-hidden="true" />
                  )}
                  {isLoading ? "Researching..." : "Find Latest Trends"}
                </button>
              </div>
            </div>

            {status === "idle" && <TrendingEmptyState onSearch={() => void search()} />}
            {status === "checking" && (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                Loading the saved topics...
              </div>
            )}
            {isLoading && <ResearchProgress stages={stages} />}
            {status === "error" && <TrendingErrorState message={error ?? TRENDING_ERROR_MESSAGE} onRetry={() => void search()} />}
            {result && error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                {error}
              </p>
            )}
            {result && <TrendingResults result={result} />}
          </div>
        </main>
      </div>

      {isPromptEditorOpen && <TrendingPromptModal onClose={() => setIsPromptEditorOpen(false)} />}
    </div>
  )
}
