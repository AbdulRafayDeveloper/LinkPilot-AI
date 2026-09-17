"use client"

import React, { useEffect, useState } from "react"
import { Gauge, Loader2 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { AI_PROVIDER_LABELS } from "@/constants/aiProviders"
import { AI_USAGE_DAYS, AI_USAGE_ENDPOINT, MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import type { AiUsageSummary } from "@/types/ai"

const RANGE_LABELS: Record<(typeof AI_USAGE_DAYS)[number], string> = { 1: "Last 24 hours", 7: "Last 7 days", 30: "Last 30 days" }
const count = (value: number) => value.toLocaleString()
const MODULES_SHOWN = 8

/**
 * Budget tracking for admins: what each AI provider used over a window (calls, tokens, speech, images)
 * and the modules that used the most, from the usage every AI call records (services/aiUsage.ts).
 */
export const AiUsagePanel: React.FC = () => {
  const [days, setDays] = useState<(typeof AI_USAGE_DAYS)[number]>(AI_USAGE_DAYS[0])
  const [summary, setSummary] = useState<AiUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<AiUsageSummary>(`${AI_USAGE_ENDPOINT}?days=${days}`, { signal: controller.signal })
      .then(({ data }) => {
        setSummary(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : MODEL_PRIORITY_MESSAGES.usageFailed)
      })
    return () => controller.abort()
  }, [days])

  const current = summary?.days === days ? summary : null

  return (
    <section aria-labelledby="ai-usage" className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-usage" className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
          <Gauge size={17} className="text-primary" aria-hidden="true" />
          AI usage by provider
        </h2>
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value) as (typeof AI_USAGE_DAYS)[number])}
          aria-label="Usage window"
          className="rounded-lg border border-outline-variant bg-white px-2 py-1 text-[12px] font-semibold text-on-surface"
        >
          {AI_USAGE_DAYS.map((option) => (
            <option key={option} value={option}>
              {RANGE_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : !current ? (
        <p role="status" className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
          Loading usage...
        </p>
      ) : (
        <>
          {/* A card per provider on a phone, the table from md up */}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:hidden" aria-label="Usage by provider">
            {current.byProvider.map((row) => (
              <li key={row.provider} data-provider={row.provider} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[12px]">
                <p className="font-semibold text-on-surface">{AI_PROVIDER_LABELS[row.provider]}</p>
                <p className="mt-1 text-on-surface-variant">
                  {count(row.calls)} calls · {count(row.totalTokens)} tokens
                </p>
                <p className="text-outline">
                  {count(row.inputTokens)} in, {count(row.outputTokens)} out
                  {row.audioSeconds > 0 && ` · ${count(Math.round(row.audioSeconds / 6) / 10)} min speech`}
                  {row.images > 0 && ` · ${count(row.images)} images`}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-outline-variant md:block">
            <table className="w-full min-w-[560px] border-collapse text-left text-[12px]" aria-label="Usage by provider">
              <thead className="bg-surface-container-lowest text-[11px] uppercase tracking-wide text-outline">
                <tr>
                  {["Provider", "Calls", "Input tokens", "Output tokens", "Total tokens", "Speech", "Images"].map((heading) => (
                    <th key={heading} scope="col" className="px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.byProvider.map((row) => (
                  <tr key={row.provider} data-provider={row.provider} className="border-t border-outline-variant/70">
                    <th scope="row" className="px-3 py-2 font-semibold text-on-surface">
                      {AI_PROVIDER_LABELS[row.provider]}
                    </th>
                    <td className="px-3 py-2">{count(row.calls)}</td>
                    <td className="px-3 py-2">{count(row.inputTokens)}</td>
                    <td className="px-3 py-2">{count(row.outputTokens)}</td>
                    <td className="px-3 py-2 font-semibold">{count(row.totalTokens)}</td>
                    <td className="px-3 py-2">{row.audioSeconds > 0 ? `${count(Math.round(row.audioSeconds / 6) / 10)} min` : "0"}</td>
                    <td className="px-3 py-2">{count(row.images)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current.byModule.length > 0 && (
            <p className="text-[12px] text-on-surface-variant">
              <span className="font-semibold text-on-surface">Most used: </span>
              {current.byModule
                .slice(0, MODULES_SHOWN)
                .map((row) => `${row.title} on ${AI_PROVIDER_LABELS[row.provider]} (${count(row.totalTokens)} tokens, ${count(row.calls)} calls)`)
                .join(" · ")}
            </p>
          )}
        </>
      )}
    </section>
  )
}
