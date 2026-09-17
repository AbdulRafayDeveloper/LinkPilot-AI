"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ExternalLink, Eye, History, Loader2, RefreshCw, SquarePlus, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { CopyButton } from "@/components/ui/CopyButton"
import { Pagination } from "@/components/ui/Pagination"
import { DateRangeFilters, FilterPanel, SearchFilter, SelectFilter, historyLabelClass as labelClass } from "@/components/history/HistoryFilters"
import { SavedTopicModal, SavedTopicStatusBadge, searchedOn } from "@/components/trending-topics/SavedTopicModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import {
  NO_FORMAT_FILTER,
  SAVED_TOPIC_STATUSES,
  TRENDING_HISTORY_ENDPOINT,
  TRENDING_HISTORY_MESSAGES,
  TRENDING_POST_FORMATS,
  getPostFormat,
  linkedInSearchUrl,
  type SavedTopicStatus,
} from "@/constants/trending"
import type { SavedTopic, SavedTopicsPage } from "@/types/trendingHistory"

// What the filter controls hold. Days stay as the date inputs give them (YYYY-MM-DD) until a request
interface FilterState {
  search: string
  category: string
  format: string
  status: SavedTopicStatus | ""
  fromDay: string
  toDay: string
}

const NO_FILTERS: FilterState = { search: "", category: "", format: "", status: "", fromDay: "", toDay: "" }

const FORMAT_OPTIONS = [...TRENDING_POST_FORMATS, { id: NO_FORMAT_FILTER, label: "No format (older searches)" }]

function queryString(filters: FilterState, search: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set("search", search)
  if (filters.category) params.set("category", filters.category)
  if (filters.format) params.set("format", filters.format)
  if (filters.status) params.set("status", filters.status)
  return appendDayRange(params, filters.fromDay, filters.toDay).toString()
}

// A topic is named by its search and its title, which, unlike its place in the list, never shifts
const topicKey = (topic: SavedTopic) => `${topic.searchId}|${topic.title}`

const formatLabel = (topic: SavedTopic) => (topic.postFormat ? getPostFormat(topic.postFormat).label : "No format")

// The topic's LinkedIn searches, each one opening that search on LinkedIn
const SearchLinks: React.FC<{ topic: SavedTopic }> = ({ topic }) =>
  topic.linkedinSearches.length > 0 ? (
    <ul className="flex flex-col gap-1" aria-label={`LinkedIn searches for ${topic.title}`}>
      {topic.linkedinSearches.map((query) => (
        <li key={query} className="min-w-0">
          <a
            href={linkedInSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Search LinkedIn for ${query}`}
            className="group/search inline-flex max-w-full items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 text-[12px] text-on-surface transition-colors hover:bg-primary-fixed/50 hover:text-primary"
          >
            <span className="truncate">{query}</span>
            <ExternalLink size={11} className="shrink-0 text-outline group-hover/search:text-primary" aria-hidden="true" />
            <span className="sr-only">(opens LinkedIn in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <span className="text-[12px] text-outline">None</span>
  )

const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

// View details opens the topic in full; Delete removes it at once, with no confirmation
const TopicActions: React.FC<{ topic: SavedTopic; onView: () => void; onDelete: () => void }> = ({ topic, onView, onDelete }) => (
  <div className="flex items-center gap-1.5">
    <button type="button" onClick={onView} aria-label={`View details for ${topic.title}`} title="View details" className={`${iconButton} text-on-surface-variant hover:bg-primary-fixed/40 hover:text-primary`}>
      <Eye size={15} aria-hidden="true" />
    </button>
    <button type="button" onClick={onDelete} aria-label={`Delete ${topic.title}`} title="Delete" className={`${iconButton} text-on-surface-variant hover:border-error/40 hover:bg-error-container hover:text-error`}>
      <Trash2 size={15} aria-hidden="true" />
    </button>
  </div>
)

const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Every topic every Trending Topics search has found, 50 to a page. Paging, search and filters all
 * run on the server, so a filter covers the whole history and not only the page on screen. Each
 * topic can be opened in full (with its source, which the list leaves out) or deleted at once.
 */
export default function TrendingHistoryClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<SavedTopicsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The request whose answer is on screen, so loading is whatever has been asked for and not yet answered
  const [answeredRequest, setAnsweredRequest] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [viewing, setViewing] = useState<SavedTopic | null>(null)
  // Topics deleted on this page: they leave the list at once, before the server answers
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  const badDateRange = isBackwardsRange(filters.fromDay, filters.toDay)
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  // Typing settles before the list is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(filters.search.trim(), HISTORY_DEBOUNCE_MS)
  const query = queryString(filters, filters.search.trim() ? settledSearch : "", page)
  const requestKey = `${query}#${reloadAttempt}`
  const isLoading = !badDateRange && answeredRequest !== requestKey

  useEffect(() => {
    if (badDateRange) return
    // A newer request replaces the one still on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<SavedTopicsPage>(`${TRENDING_HISTORY_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : TRENDING_HISTORY_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnsweredRequest(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page, badDateRange])

  // Any change to what is filtered starts again from the first page
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters(NO_FILTERS)
    setPage(1)
  }

  const changePage = (next: number) => {
    setPage(next)
    setActionError(null)
  }

  /**
   * Deletes a topic straight away. It leaves the list at once; once the server confirms, the page is
   * read again so it fills back up and the count is right. A topic that turns out to be gone
   * already counts as deleted. Any other failure puts it back and says so.
   */
  const deleteTopic = async (topic: SavedTopic) => {
    const key = topicKey(topic)
    setActionError(null)
    setRemoved((current) => new Set(current).add(key))
    try {
      await requestApi<{ deleted: number }>(`${TRENDING_HISTORY_ENDPOINT}/${encodeURIComponent(topic.searchId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: topic.title }),
      })
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : TRENDING_HISTORY_MESSAGES.deleteFailed
      if (message !== TRENDING_HISTORY_MESSAGES.topicGone) {
        setRemoved((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
        setActionError(message || TRENDING_HISTORY_MESSAGES.deleteFailed)
        return
      }
    }
    setReloadAttempt((attempt) => attempt + 1)
  }

  const items = result?.items ?? []
  const visibleItems = items.filter((topic) => !removed.has(topicKey(topic)))
  // Deleted rows still waiting for the page to be read again are already out of the count
  const total = Math.max(0, (result?.total ?? 0) - (items.length - visibleItems.length))
  const totalPages = result?.totalPages ?? 1
  const pageSize = result?.pageSize ?? 0
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(total, (page - 1) * pageSize + visibleItems.length)

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <History size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Existing Trending Topics
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">Every topic found so far, newest search first.</p>
              </div>
              <Link
                href="/trending-topics"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <SquarePlus size={16} aria-hidden="true" />
                Create new topics
              </Link>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]"
              canClear={hasFilters}
              onClear={resetFilters}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : result
                    ? `Showing ${firstShown.toLocaleString()} to ${lastShown.toLocaleString()} of ${total.toLocaleString()} ${total === 1 ? "topic" : "topics"}`
                    : "Loading topics..."
              }
            >
              <SearchFilter value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Title or why it is trending" />
              <SelectFilter
                label="Category"
                allLabel="All categories"
                value={filters.category}
                options={(result?.categories ?? []).map((category) => ({ id: category, label: category }))}
                onChange={(value) => updateFilter("category", value)}
              />
              <SelectFilter label="Post format" allLabel="All formats" value={filters.format} options={FORMAT_OPTIONS} onChange={(value) => updateFilter("format", value)} />
              <SelectFilter
                label="Status"
                allLabel="Any status"
                value={filters.status}
                options={SAVED_TOPIC_STATUSES}
                onChange={(value) => updateFilter("status", value as SavedTopicStatus | "")}
              />
              <DateRangeFilters
                fromLabel="Searched from"
                toLabel="Searched to"
                fromDay={filters.fromDay}
                toDay={filters.toDay}
                onFromChange={(day) => updateFilter("fromDay", day)}
                onToChange={(day) => updateFilter("toDay", day)}
              />
            </FilterPanel>

            {error && !result ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={() => setReloadAttempt((attempt) => attempt + 1)} className={pagerButton}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading topics...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <History size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">
                  {hasFilters ? TRENDING_HISTORY_MESSAGES.noResults : TRENDING_HISTORY_MESSAGES.empty}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {(actionError || error) && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {actionError ?? error}
                  </p>
                )}

                {/* A table where there is room for one */}
                {/* The table from 2xl, where its 1080px fit beside the open sidebar; cards below */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm 2xl:block">
                  <table className="w-full min-w-[1080px] border-collapse text-left">
                    <caption className="sr-only">Saved trending topics, page {page} of {totalPages}</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {["Topic", "LinkedIn searches", "Category", "Format", "Event", "Searched", "Status", "Post", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${labelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((topic) => (
                        <tr key={topicKey(topic)} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="min-w-[210px] max-w-[320px] px-3 py-2.5">
                            <p className="text-[13px] font-semibold leading-snug text-on-surface">{topic.title}</p>
                            {topic.whyTrending && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-on-surface-variant">{topic.whyTrending}</p>}
                          </td>
                          <td className="w-[220px] max-w-[220px] px-3 py-2.5">
                            <SearchLinks topic={topic} />
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-on-surface">{topic.category || "None"}</td>
                          <td className="px-3 py-2.5 text-[12px] text-on-surface">{formatLabel(topic)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface">
                            {topic.eventDate ?? "Not stated"}
                            {topic.freshness && <span className="block text-[11px] text-outline">{topic.freshness}</span>}
                          </td>
                          <td className="min-w-[96px] px-3 py-2.5 text-[12px] text-on-surface">{searchedOn(topic.searchedAt)}</td>
                          <td className="px-3 py-2.5">
                            <SavedTopicStatusBadge status={topic.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            {topic.post ? <CopyButton text={topic.post} label={`Copy the post for ${topic.title}`} showLabel /> : <span className="text-[12px] text-outline">None</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <TopicActions topic={topic} onView={() => setViewing(topic)} onDelete={() => void deleteTopic(topic)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards on a phone, with the same fields */}
                <ul className="flex flex-col gap-3 2xl:hidden">
                  {visibleItems.map((topic) => (
                    <li key={topicKey(topic)} className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-snug text-on-surface">{topic.title}</p>
                        <SavedTopicStatusBadge status={topic.status} />
                      </div>
                      {topic.whyTrending && <p className="line-clamp-3 text-[12px] leading-snug text-on-surface-variant">{topic.whyTrending}</p>}
                      <div>
                        <p className={`mb-1 ${labelClass}`}>LinkedIn searches</p>
                        <SearchLinks topic={topic} />
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-[12px]">
                        <div>
                          <dt className={labelClass}>Category</dt>
                          <dd className="text-on-surface">{topic.category || "None"}</dd>
                        </div>
                        <div>
                          <dt className={labelClass}>Format</dt>
                          <dd className="text-on-surface">{formatLabel(topic)}</dd>
                        </div>
                        <div>
                          <dt className={labelClass}>Event</dt>
                          <dd className="text-on-surface">{topic.eventDate ?? "Not stated"}</dd>
                        </div>
                        <div>
                          <dt className={labelClass}>Searched</dt>
                          <dd className="text-on-surface">{searchedOn(topic.searchedAt)}</dd>
                        </div>
                      </dl>
                      <div className="flex items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
                        <TopicActions topic={topic} onView={() => setViewing(topic)} onDelete={() => void deleteTopic(topic)} />
                        {topic.post && <CopyButton text={topic.post} label={`Copy the post for ${topic.title}`} showLabel />}
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination page={page} totalPages={totalPages} onPageChange={changePage} isLoading={isLoading} />
              </div>
            )}
          </div>
        </main>
      </div>

      {viewing && <SavedTopicModal topic={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
