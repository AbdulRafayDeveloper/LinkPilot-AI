"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { SAVED_TOPIC_STATUSES, TRENDING_HISTORY_ENDPOINT, TRENDING_HISTORY_MESSAGES, type SavedTopicStatus } from "@/constants/trending"
import type { SavedTopic, SavedTopicDetail } from "@/types/trendingHistory"
import { TopicCard } from "./TopicCard"

const STATUS_STYLE: Record<SavedTopicStatus, string> = {
  current: "bg-success-container text-on-success-container",
  earlier: "bg-surface-container-high text-on-surface-variant",
  dismissed: "bg-error-container text-error",
}

const statusLabel = (status: SavedTopicStatus) => SAVED_TOPIC_STATUSES.find((entry) => entry.id === status)?.label ?? status

/** Where a saved topic's search stands, the same badge in the list and on the topic's own view. */
export const SavedTopicStatusBadge: React.FC<{ status: SavedTopicStatus }> = ({ status }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
    {statusLabel(status)}
  </span>
)

export const searchedOn = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const metaLabel = "text-[10px] font-bold uppercase tracking-wider text-outline"

/**
 * One saved topic in full, opened from the saved topics list: the topic exactly as the search page
 * shows it (why it is trending, the angle, every LinkedIn search, the post, keywords, assessment,
 * screenshot and every source), with the search it came from above it. The list leaves the source
 * out, so it is named here first.
 */
export const SavedTopicModal: React.FC<{ topic: SavedTopic; onClose: () => void }> = ({ topic, onClose }) => {
  const [detail, setDetail] = useState<SavedTopicDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const url = `${TRENDING_HISTORY_ENDPOINT}/${encodeURIComponent(topic.searchId)}?${new URLSearchParams({ title: topic.title })}`
    requestApi<SavedTopicDetail>(url, { signal: controller.signal })
      .then(({ data }) => {
        setDetail(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : TRENDING_HISTORY_MESSAGES.detailFailed)
      })
    return () => controller.abort()
  }, [topic.searchId, topic.title, attempt])

  const source = detail?.topic.primary_reference

  return (
    <Modal title="Trending topic" description={topic.title} onClose={onClose}>
      {error && !detail ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
          {error !== TRENDING_HISTORY_MESSAGES.topicGone && error !== TRENDING_HISTORY_MESSAGES.unreadable && (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setAttempt((current) => current + 1)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      ) : !detail ? (
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
          <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
          Opening the topic...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div className="min-w-0">
              <dt className={metaLabel}>Source</dt>
              <dd className="mt-0.5 min-w-0">
                {source ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
                  >
                    <span className="truncate">{source.source || source.title}</span>
                    <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-[13px] text-outline">None</span>
                )}
                {source?.title && <p className="mt-0.5 truncate text-[12px] text-on-surface-variant" title={source.title}>{source.title}</p>}
              </dd>
            </div>
            <div>
              <dt className={metaLabel}>Searched</dt>
              <dd className="mt-0.5 text-[13px] text-on-surface">{searchedOn(detail.searchedAt)}</dd>
            </div>
            <div>
              <dt className={metaLabel}>Rank in search</dt>
              <dd className="mt-0.5 text-[13px] text-on-surface">#{detail.rank}</dd>
            </div>
            <div>
              <dt className={metaLabel}>Status</dt>
              <dd className="mt-0.5">
                <SavedTopicStatusBadge status={detail.status} />
              </dd>
            </div>
          </dl>

          <TopicCard topic={detail.topic} researchOpen />
        </div>
      )}
    </Modal>
  )
}
