"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, FileKey2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { ContentDialog } from "@/components/important-content/ContentDialog"
import { ContentDetailsDialog } from "@/components/important-content/ContentDetailsDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { requestApi } from "@/lib/apiClient"
import { toPlainText } from "@/lib/richText"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { CONTENT_PREVIEW_MAX_LENGTH, IMPORTANT_CONTENT_ENDPOINT, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import type { ImportantContent, ImportantContentPage } from "@/types/importantContent"

const savedOn = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

// The table shows the words, not the formatting marks; View details shows the formatting
const preview = (description: string) => {
  const text = toPlainText(description)
  return text.length > CONTENT_PREVIEW_MAX_LENGTH ? `${text.slice(0, CONTENT_PREVIEW_MAX_LENGTH).trimEnd()}...` : text
}

// Copy takes the saved text; an entry with no description copies its name
const copyText = (entry: ImportantContent) => entry.description || entry.name

const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
const actionButton =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
  <span className="inline-flex max-w-full truncate rounded-full bg-primary-fixed/70 px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">{type}</span>
)

/**
 * Important Content: saved text with a name, an optional description and a type of the user's
 * own. Search by name and the type filter run on the server, 50 entries to a page.
 */
export default function ImportantContentClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ImportantContentPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState<{ entry: ImportantContent | null } | null>(null)
  // The entry opened in full; its description comes with the list, so opening it asks for nothing
  const [viewing, setViewing] = useState<ImportantContent | null>(null)
  const [deleting, setDeleting] = useState<ImportantContent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Typing settles before the list is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (type) params.set("type", type)
  const query = params.toString()
  const requestKey = `${query}#${attempt}`
  const isLoading = answered !== requestKey

  useEffect(() => {
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<ImportantContentPage>(`${IMPORTANT_CONTENT_ENDPOINT}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page])

  const reload = () => setAttempt((count) => count + 1)
  const hasFilters = Boolean(search || type)
  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pageSize = result?.pageSize ?? 0
  const totalPages = result?.totalPages ?? 1
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(total, (page - 1) * pageSize + items.length)
  // A type chosen in the filter stays offered even if its last entry was just edited away
  const typeOptions = [...new Set([...(result?.types ?? []), ...(type ? [type] : [])])].map((entry) => ({ id: entry, label: entry }))

  const saved = () => {
    const isNew = dialog?.entry === null
    setDialog(null)
    // A new entry is newest, so it lands on the first page; an edit stays where it is
    if (isNew) setPage(1)
    reload()
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi(`${IMPORTANT_CONTENT_ENDPOINT}/${deleting.id}`, { method: "DELETE" })
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  const actions = (entry: ImportantContent) => (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" onClick={() => setViewing(entry)} aria-label={`View details of ${entry.name}`} className={`${actionButton} hover:text-primary`}>
        <Eye size={13} aria-hidden="true" />
        View details
      </button>
      <CopyButton text={copyText(entry)} label={`Copy ${entry.name}`} showLabel />
      <button type="button" onClick={() => setDialog({ entry })} aria-label={`Edit ${entry.name}`} className={`${actionButton} hover:text-primary`}>
        <Pencil size={13} aria-hidden="true" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null)
          setDeleting(entry)
        }}
        aria-label={`Delete ${entry.name}`}
        className={`${actionButton} hover:text-error`}
      >
        <Trash2 size={13} aria-hidden="true" />
        Delete
      </button>
    </div>
  )

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
                  <FileKey2 size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Important Content
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">Logins, links and text worth finding again, sorted by types you choose.</p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ entry: null })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <Plus size={16} aria-hidden="true" />
                Add New Content
              </button>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={() => {
                setSearch("")
                setType("")
                setPage(1)
              }}
              summary={result ? `Showing ${firstShown.toLocaleString()} to ${lastShown.toLocaleString()} of ${total.toLocaleString()}` : "Loading your content..."}
            >
              <SearchFilter
                value={search}
                onChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                placeholder="Search by name"
              />
              <SelectFilter
                label="Type"
                allLabel="All types"
                value={type}
                options={typeOptions}
                onChange={(value) => {
                  setType(value)
                  setPage(1)
                }}
              />
            </FilterPanel>

            {error && !result ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={reload} className={pagerButton}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your content...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <FileKey2 size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{hasFilters ? IMPORTANT_CONTENT_MESSAGES.noResults : IMPORTANT_CONTENT_MESSAGES.empty}</p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {error && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {error}
                  </p>
                )}

                {/* The table from xl, where it fits beside the open sidebar; cards below, two to a row on a tablet */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <caption className="sr-only">Important content, page {page} of {totalPages}</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {["Name", "Type", "Description", "Updated", ""].map((heading, index) => (
                          <th key={heading || index} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((entry) => (
                        <tr key={entry.id} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="max-w-[240px] px-3 py-2.5">
                            <p className="break-words text-[13px] font-semibold text-on-surface">{entry.name}</p>
                            {entry.owner && <p className="text-[11px] text-outline">By {entry.owner}</p>}
                          </td>
                          <td className="max-w-[160px] px-3 py-2.5">
                            <TypeBadge type={entry.type} />
                          </td>
                          <td className="max-w-[420px] px-3 py-2.5">
                            {entry.description ? (
                              <p className="line-clamp-3 whitespace-pre-wrap break-words font-code text-[12px] leading-relaxed text-on-surface-variant">{preview(entry.description)}</p>
                            ) : (
                              <span className="text-[12px] text-outline">No description</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface-variant">{savedOn(entry.updatedAt)}</td>
                          <td className="px-3 py-2">{actions(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((entry) => (
                    <li key={entry.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-[14px] font-semibold text-on-surface">{entry.name}</p>
                          {entry.owner && <p className="text-[11px] text-outline">By {entry.owner}</p>}
                        </div>
                        <TypeBadge type={entry.type} />
                      </div>
                      {entry.description && (
                        <p className="line-clamp-4 whitespace-pre-wrap break-words font-code text-[12px] leading-relaxed text-on-surface-variant">{preview(entry.description)}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-outline-variant/70 pt-2">
                        <span className="whitespace-nowrap text-[11px] text-outline">{savedOn(entry.updatedAt)}</span>
                        {actions(entry)}
                      </div>
                    </li>
                  ))}
                </ul>

                <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || isLoading} className={pagerButton}>
                    <ChevronLeft size={14} aria-hidden="true" />
                    Previous
                  </button>
                  <p className="flex items-center gap-2 text-[12px] text-on-surface-variant" aria-live="polite">
                    {isLoading && <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />}
                    Page {page} of {totalPages}
                  </p>
                  <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages || isLoading} className={pagerButton}>
                    Next
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </nav>
              </div>
            )}
          </div>
        </main>
      </div>

      {viewing && (
        <ContentDetailsDialog
          entry={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null)
            setDialog({ entry: viewing })
          }}
        />
      )}

      {dialog && <ContentDialog entry={dialog.entry} knownTypes={result?.types ?? []} onClose={() => setDialog(null)} onSaved={saved} />}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description="This removes the name, the description and the type. It can't be undone."
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={isDeleting} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete content
              </button>
            </div>
          }
        >
          {deleteError ? (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
              {deleteError}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Type: <TypeBadge type={deleting.type} />
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
