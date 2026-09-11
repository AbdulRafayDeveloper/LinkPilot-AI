"use client"

import React from "react"
import { AlertTriangle, Flame, RefreshCw } from "lucide-react"
import { TRENDING_TOPIC_COUNT } from "@/constants/trending"

const panelClass =
  "flex flex-col items-center justify-center text-center gap-3 p-8 bg-white border border-outline-variant rounded-2xl shadow-sm min-h-[260px]"

export const TrendingEmptyState: React.FC<{ onSearch: () => void }> = ({ onSearch }) => (
  <div className={panelClass}>
    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
      <Flame size={22} aria-hidden="true" />
    </div>
    <h2 className="text-lg font-bold text-on-surface">Find what&apos;s worth talking about today.</h2>
    <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
      Search the latest web, AI and SaaS developments and get {TRENDING_TOPIC_COUNT} ready-to-post LinkedIn topics.
    </p>
    <button
      type="button"
      onClick={onSearch}
      className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-95 transition-all"
    >
      <Flame size={16} aria-hidden="true" />
      Find Latest Trends
    </button>
  </div>
)

export const TrendingErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className={panelClass}>
    <div className="w-12 h-12 rounded-2xl bg-error-container flex items-center justify-center text-error">
      <AlertTriangle size={22} aria-hidden="true" />
    </div>
    <h2 className="text-lg font-bold text-on-surface">No live trends this time</h2>
    <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high active:scale-95 transition-all"
    >
      <RefreshCw size={16} aria-hidden="true" />
      Try again
    </button>
  </div>
)
