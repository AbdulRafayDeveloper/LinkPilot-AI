"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Check, ChevronsDownUp, ChevronsUpDown, Copy, Eye, EyeOff, FileText, Folder, FolderCog, FolderInput, History, Loader2, RefreshCw, SquarePlus, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { Pagination } from "@/components/ui/Pagination"
import {
  DateRangeFilters,
  FilterPanel,
  SearchFilter,
  SearchableSelectFilter,
  SelectFilter,
  historyLabelClass,
} from "@/components/history/HistoryFilters"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { requestApi } from "@/lib/apiClient"
import { appendDayRange, isBackwardsRange } from "@/lib/dayRange"
import { HISTORY_DEBOUNCE_MS, HISTORY_MESSAGES } from "@/constants/historyFilters"
import {
  SAVED_OUTPUTS_ENDPOINT,
  SAVED_OUTPUT_MESSAGES,
  SAVED_OUTPUT_TEXT_PREVIEW_CHARS,
  getSavedOutputTool,
  type SavedOutputTool,
  type SavedOutputToolId,
} from "@/constants/savedOutputs"
import type { SavedOutput, SavedOutputDetail, SavedOutputsPage } from "@/types/savedOutputs"
import type { PromptFolder } from "@/types/promptFolders"
import { IN_ANY_FOLDER, PROMPT_FOLDER_MESSAGES, UNFILED_FOLDER } from "@/constants/promptFolders"
import { usePromptFolders } from "@/hooks/usePromptFolders"
import { MoveToFolderDialog } from "./MoveToFolderDialog"
import { FoldersDialog } from "./FoldersDialog"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { describeSource } from "@/constants/aiProviders"

interface FilterState {
  search: string
  option: string
  context: string
  // Only a tool with folders uses this; for the others it stays empty and is never sent
  folder: string
  fromDay: string
  toDay: string
}

const NO_FILTERS: FilterState = { search: "", option: "", context: "", folder: "", fromDay: "", toDay: "" }

const writtenOn = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

// Search + one or two choice lists + two dates, laid out on one row on a wide screen
const COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_repeat(2,minmax(0,0.9fr))]",
  2: "lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]",
  3: "lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]",
}

function queryString(filters: FilterState, search: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set("search", search)
  if (filters.option) params.set("option", filters.option)
  if (filters.context) params.set("context", filters.context)
  if (filters.folder) params.set("folder", filters.folder)
  return appendDayRange(params, filters.fromDay, filters.toDay).toString()
}

// Long enough to be cut in the table: past the preview length, or more than a few lines
/** "In a folder", with how many prompts are filed once the folders have loaded. */
const filedLabel = (folders: PromptFolder[] | null): string => {
  const filed = (folders ?? []).reduce((total, folder) => total + folder.promptCount, 0)
  return folders && folders.length > 0 ? `${PROMPT_FOLDER_MESSAGES.inAnyFolder} (${filed})` : PROMPT_FOLDER_MESSAGES.inAnyFolder
}

const isLong = (item: SavedOutput) =>
  item.texts.some((part) => part.text.length > SAVED_OUTPUT_TEXT_PREVIEW_CHARS || part.text.split("\n").length > 3)

// Tall enough to tap comfortably until the table takes over on a wide screen
const actionButton =
  "inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline xl:min-h-0 transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
const toolbarButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** The choices a record was written with (violet), the facts about it (neutral) and its folder. */
const RecordTags: React.FC<{ item: SavedOutput }> = ({ item }) =>
  item.choices.length + item.details.length === 0 && !describeSource(item) && !item.folder ? (
    <span className="text-[12px] text-outline">None</span>
  ) : (
    <ul className="flex flex-wrap gap-1" aria-label="Written with">
      {item.folder && (
        <li className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-surface">
          <Folder size={11} className="shrink-0 text-secondary-container" aria-hidden="true" />
          <span className="truncate">{item.folder.name}</span>
          <span className="sr-only">folder</span>
        </li>
      )}
      {item.choices.map((label) => (
        <li key={`choice-${label}`} className="rounded-full bg-primary-fixed/60 px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
          {label}
        </li>
      ))}
      {item.details.map((label) => (
        <li key={`detail-${label}`} className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          {label}
        </li>
      ))}
      {describeSource(item) && (
        <li className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          <AiSourceLabel source={item} prefix="" />
        </li>
      )}
    </ul>
  )

/** A copy action named after what it copies ("Copy subject"), so several on one row never read alike. */
const CopyTextButton: React.FC<{ text: string; buttonText: string; label: string }> = ({ text, buttonText, label }) => {
  const { copied, copy } = useCopyToClipboard()
  return (
    <button type="button" onClick={() => copy(text)} aria-label={label} className={`${actionButton} ${copied ? "text-primary" : "hover:text-primary"}`}>
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? "Copied" : buttonText}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  )
}

/** The copy icon that sits beside a text shown in the table, so what you read is one click from the clipboard. */
const CopyIconButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const { copied, copy } = useCopyToClipboard()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={label}
      title={copied ? "Copied" : "Copy"}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-container-high ${copied ? "text-primary" : "text-outline hover:text-primary"}`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  )
}

type SourceCopyState = "idle" | "copying" | "copied" | "failed"

/**
 * Copies what a record was written from, which the list leaves out. The request is handed to the
 * clipboard rather than awaited first, because the permission a click grants can run out while a
 * slow request is on its way; a browser without that falls back to reading it, then writing it.
 */
const SourceCopyButton: React.FC<{ item: SavedOutput; sourceLabel: string; loadSource: (id: string) => Promise<string> }> = ({
  item,
  sourceLabel,
  loadSource,
}) => {
  const [state, setState] = useState<SourceCopyState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const what = sourceLabel.toLowerCase()

  const settle = (next: SourceCopyState) => {
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("idle"), 1500)
  }

  const copy = async () => {
    setState("copying")
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = loadSource(item.id).then((source) => new Blob([source], { type: "text/plain" }))
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })])
      } else {
        await navigator.clipboard.writeText(await loadSource(item.id))
      }
      settle("copied")
    } catch {
      try {
        await navigator.clipboard.writeText(await loadSource(item.id))
        settle("copied")
      } catch {
        settle("failed")
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "copying"}
      aria-label={`Copy the ${what} for ${item.title}`}
      className={`${actionButton} ${state === "copied" ? "text-primary" : state === "failed" ? "text-error" : "hover:text-primary"}`}
    >
      {state === "copying" ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : state === "copied" ? (
        <Check size={13} aria-hidden="true" />
      ) : state === "failed" ? (
        <AlertTriangle size={13} aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : `Copy ${what}`}
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? `${sourceLabel} copied to clipboard` : state === "failed" ? SAVED_OUTPUT_MESSAGES.sourceFailed : ""}
      </span>
    </button>
  )
}

/**
 * What a record wrote, in its table cell. A tool that hides its texts (Connection Note) shows them
 * only when opened; every other tool shows them, cut to a few lines until opened. Every text on
 * show has a copy icon beside it, and a hidden one a Copy button beside Show, so it can be copied
 * without opening it.
 */
const TextsCell: React.FC<{ tool: SavedOutputTool; item: SavedOutput; isOpen: boolean; onToggle: () => void }> = ({ tool, item, isOpen, onToggle }) => {
  const showTexts = !tool.hideTexts || isOpen
  const canToggle = tool.hideTexts || isLong(item)
  const noun = tool.noun.one
  const toggleText = tool.hideTexts ? `${isOpen ? "Hide" : "Show"} ${noun}` : isOpen ? "Show less" : "Show all"
  const ToggleIcon = tool.hideTexts ? (isOpen ? EyeOff : Eye) : isOpen ? ChevronsDownUp : ChevronsUpDown

  return (
    <div className="flex flex-col items-start gap-1.5">
      {showTexts &&
        item.texts.map((part) => (
          <div key={part.label} className="flex w-full items-start gap-1">
            <div className="min-w-0 flex-1">
              {item.texts.length > 1 && <p className={historyLabelClass}>{part.label}</p>}
              <p className={`whitespace-pre-wrap break-words text-[12px] leading-relaxed text-on-surface ${!tool.hideTexts && !isOpen ? "line-clamp-3" : ""}`}>{part.text}</p>
            </div>
            <CopyIconButton text={part.text} label={`Copy the ${part.label.toLowerCase()} for ${item.title}`} />
          </div>
        ))}
      {(canToggle || !showTexts) && (
        <div className="-ml-2 flex flex-wrap items-center gap-0.5">
          {canToggle && (
            <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-label={`${toggleText} for ${item.title}`} className={`${actionButton} hover:text-primary`}>
              <ToggleIcon size={13} aria-hidden="true" />
              {toggleText}
              {tool.hideTexts && item.characterCount !== null && <span className="font-normal text-outline">· {item.characterCount} characters</span>}
            </button>
          )}
          {!showTexts &&
            item.texts.map((part) => (
              <CopyTextButton key={part.label} text={part.text} buttonText={`Copy ${part.label.toLowerCase()}`} label={`Copy the ${part.label.toLowerCase()} for ${item.title}`} />
            ))}
        </div>
      )}
    </div>
  )
}

/** The whole record: who or what it was for, everything written and what it was written from. */
const RecordDialog: React.FC<{ item: SavedOutput; loadDetail: (id: string) => Promise<SavedOutputDetail>; onClose: () => void }> = ({ item, loadDetail, onClose }) => {
  const [detail, setDetail] = useState<SavedOutputDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!item.sourceLabel) return
    let isCurrent = true
    loadDetail(item.id)
      .then((data) => {
        if (!isCurrent) return
        setDetail(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : SAVED_OUTPUT_MESSAGES.sourceFailed)
      })
    return () => {
      isCurrent = false
    }
  }, [item.id, item.sourceLabel, loadDetail, attempt])

  return (
    <Modal title={item.title} description={item.subtitle ?? undefined} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-on-surface-variant">
          <RecordTags item={item} />
          <span>Written {writtenOn(item.createdAt)}</span>
        </div>

        {item.texts.map((part) => (
          <section key={part.label} className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className={historyLabelClass}>{part.label}</h3>
              <CopyTextButton text={part.text} buttonText={`Copy ${part.label.toLowerCase()}`} label={`Copy the ${part.label.toLowerCase()} for ${item.title}`} />
            </div>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface">{part.text}</p>
          </section>
        ))}

        {item.sourceLabel && (
          <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className={historyLabelClass}>{item.sourceLabel} it was written from</h3>
              {detail && (
                <CopyTextButton text={detail.source} buttonText={`Copy ${item.sourceLabel.toLowerCase()}`} label={`Copy the ${item.sourceLabel.toLowerCase()} for ${item.title}`} />
              )}
            </div>
            {detail ? (
              <p className="custom-scrollbar max-h-[45dvh] overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-on-surface-variant">{detail.source}</p>
            ) : error ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-error-container px-3 py-2 text-[12px] text-error">
                {error}
                <button type="button" onClick={() => setAttempt((count) => count + 1)} className={`${actionButton} text-error hover:text-error`}>
                  <RefreshCw size={13} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : (
              <p role="status" className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
                Loading the {item.sourceLabel.toLowerCase()}...
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}

/**
 * Everything one tool has written, newest first, 50 to a page in a table (cards on a phone).
 * Paging, the search, the choice filters and the date range all run on the server, so they cover
 * every saved record and not only the ones on screen. Each row opens in full, copies what was
 * written or what it was written from, and deletes on one click.
 */
export const SavedOutputsView: React.FC<{ toolId: SavedOutputToolId }> = ({ toolId }) => {
  const tool = getSavedOutputTool(toolId)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<SavedOutputsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The request whose answer is on screen, so loading is whatever has been asked for and not yet answered
  const [answeredRequest, setAnsweredRequest] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  // The page toggle opens every row (or starts them hidden); a row's own toggle flips just that row
  const [allOpen, setAllOpen] = useState(false)
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set())
  const [viewing, setViewing] = useState<SavedOutput | null>(null)
  // Records deleted on this page: they leave the list at once, before the server answers
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  // The record being filed in a folder, and the folder manager
  const [moving, setMoving] = useState<SavedOutput | null>(null)
  const [isManagingFolders, setIsManagingFolders] = useState(false)
  // What a record was written from is read once per page load, whether it was opened or copied first
  const details = useRef(new Map<string, Promise<SavedOutputDetail>>())
  // Only a tool with folders loads any of this; for the others the hook does nothing
  const folders = usePromptFolders(tool?.folders?.endpoint)

  const endpoint = `${SAVED_OUTPUTS_ENDPOINT}/${toolId}`
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
    requestApi<SavedOutputsPage>(`${endpoint}?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        setResult(data)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (data.page !== page) setPage(data.page)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : SAVED_OUTPUT_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnsweredRequest(requestKey)
      })
    return () => controller.abort()
  }, [endpoint, query, requestKey, page, badDateRange])

  const loadDetail = useCallback(
    (id: string): Promise<SavedOutputDetail> => {
      const cached = details.current.get(id)
      if (cached) return cached
      const request = requestApi<SavedOutputDetail>(`${endpoint}/${id}`).then(({ data }) => data)
      details.current.set(id, request)
      // A failed read isn't kept, so trying again asks again
      request.catch(() => details.current.delete(id))
      return request
    },
    [endpoint]
  )
  const loadSource = useCallback((id: string) => loadDetail(id).then((detail) => detail.source), [loadDetail])

  if (!tool) return null

  // Any change to what is filtered starts again from the first page
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const changePage = (next: number) => {
    setPage(next)
    setActionError(null)
  }

  const toggleAll = () => {
    setAllOpen((current) => !current)
    setFlipped(new Set())
  }

  const toggleRow = (id: string) =>
    setFlipped((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  /**
   * Deletes a record straight away, without asking first. It leaves the list at once; once the
   * server confirms, the page is read again so it fills back up and the count is right. A record
   * that turns out to be gone already counts as deleted. Any other failure puts it back and says so.
   */
  const deleteRecord = async (item: SavedOutput) => {
    setActionError(null)
    setRemoved((current) => new Set(current).add(item.id))
    if (viewing?.id === item.id) setViewing(null)
    try {
      await requestApi<{ deleted: number }>(`${endpoint}/${item.id}`, { method: "DELETE" })
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : SAVED_OUTPUT_MESSAGES.deleteFailed
      if (message !== SAVED_OUTPUT_MESSAGES.notFound) {
        setRemoved((current) => {
          const next = new Set(current)
          next.delete(item.id)
          return next
        })
        setActionError(SAVED_OUTPUT_MESSAGES.deleteFailed)
        return
      }
    }
    details.current.delete(item.id)
    setReloadAttempt((attempt) => attempt + 1)
  }

  /**
   * Files one record in a folder, or takes it out of one. The row shows its new folder at once and
   * the counts follow; a record that no longer matches the folder being filtered leaves the list,
   * so the page is read again. A failure is thrown back to the dialog, which says so and stays open.
   */
  const moveRecord = async (item: SavedOutput, folder: PromptFolder | null) => {
    const recordEndpoint = tool?.folders?.recordEndpoint
    if (!recordEndpoint) return
    setActionError(null)
    const from = item.folder?.id ?? null
    await requestApi<unknown>(`${recordEndpoint}/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folder?.id ?? null }),
    })
    folders.countMoved(from, folder?.id ?? null)
    // The folder comes back from the dialog, so one just created is named here without waiting for the list
    setResult((current) =>
      current
        ? { ...current, items: current.items.map((row) => (row.id === item.id ? { ...row, folder: folder ? { id: folder.id, name: folder.name } : null } : row)) }
        : current
    )
    // With a folder filter on, the record may no longer belong on this page
    if (filters.folder) setReloadAttempt((attempt) => attempt + 1)
  }

  const items = result?.items ?? []
  const visibleItems = items.filter((item) => !removed.has(item.id))
  // Deleted rows still waiting for the page to be read again are already out of the count
  const total = Math.max(0, (result?.total ?? 0) - (items.length - visibleItems.length))
  const totalPages = result?.totalPages ?? 1
  const pageSize = result?.pageSize ?? 0
  const firstShown = visibleItems.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = firstShown === 0 ? 0 : firstShown + visibleItems.length - 1
  const count = (value: number) => `${value.toLocaleString()} ${value === 1 ? tool.noun.one : tool.noun.many}`
  const isOpen = (id: string) => allOpen !== flipped.has(id)
  const canOpenAny = tool.hideTexts || visibleItems.some(isLong)

  // In the table: View details and Delete always first, then every copy the tool offers (what was written,
  // then what it was written from), so rows line up however many there are. One column on a laptop, where
  // the table has about 936px beside the sidebar, and two by two from 2xl. One row on a card
  const actions = (item: SavedOutput, layout: "grid" | "row") => (
    <div
      className={
        layout === "grid"
          ? "grid grid-cols-1 justify-items-start gap-y-0.5 2xl:grid-cols-2 2xl:gap-x-2"
          : "flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5"
      }
    >
      <button type="button" onClick={() => setViewing(item)} aria-label={`View details for ${item.title}`} className={`${actionButton} hover:text-primary`}>
        <FileText size={13} aria-hidden="true" />
        View details
      </button>
      <button type="button" onClick={() => deleteRecord(item)} aria-label={`Delete the ${tool.noun.one} for ${item.title}`} className={`${actionButton} hover:text-error`}>
        <Trash2 size={13} aria-hidden="true" />
        Delete
      </button>
      {tool.folders && (
        <button
          type="button"
          onClick={() => setMoving(item)}
          aria-label={`Move ${item.title} to a folder`}
          className={`${actionButton} hover:text-primary`}
        >
          <FolderInput size={13} aria-hidden="true" />
          {item.folder ? "Move" : "Add to folder"}
        </button>
      )}
      {item.texts.map((part) => (
        <CopyTextButton key={part.label} text={part.text} buttonText={`Copy ${part.label.toLowerCase()}`} label={`Copy the ${part.label.toLowerCase()} for ${item.title}`} />
      ))}
      {item.sourceLabel && <SourceCopyButton item={item} sourceLabel={item.sourceLabel} loadSource={loadSource} />}
    </div>
  )

  const filterOptions = (filter: SavedOutputTool["filters"][number]) => {
    if (!filter.fromServer) return filter.options
    const options = result?.choices[filter.key] ?? []
    // A chosen value stays offered even when no record on the latest answer holds it any more
    const chosen = filters[filter.key]
    return chosen && !options.some((option) => option.id === chosen) ? [...options, { id: chosen, label: chosen }] : options
  }

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
                  {tool.heading}
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">{tool.intro}</p>
              </div>
              <Link
                href={tool.toolHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <SquarePlus size={16} aria-hidden="true" />
                {tool.createTitle}
              </Link>
            </div>

            {tool.folders && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setIsManagingFolders(true)} className={toolbarButton}>
                  <FolderCog size={15} aria-hidden="true" />
                  Folders
                  {folders.folders && folders.folders.length > 0 && <span className="text-outline">({folders.folders.length})</span>}
                </button>
                {folders.error && (
                  <p role="alert" className="text-[12px] text-error">
                    {folders.error}
                  </p>
                )}
              </div>
            )}

            <FilterPanel
              columnsClassName={COLUMNS[tool.filters.length] ?? COLUMNS[1]}
              canClear={hasFilters}
              onClear={() => {
                setFilters(NO_FILTERS)
                setPage(1)
              }}
              summary={
                badDateRange
                  ? HISTORY_MESSAGES.badDateRange
                  : result
                    ? `Showing ${firstShown.toLocaleString()} to ${lastShown.toLocaleString()} of ${count(total)}`
                    : `Loading ${tool.noun.many}...`
              }
            >
              <SearchFilter value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder={tool.searchPlaceholder} />
              {tool.filters.map((filter) => (
                <SelectFilter
                  key={filter.key}
                  label={filter.label}
                  allLabel={filter.allLabel}
                  value={filters[filter.key]}
                  options={filterOptions(filter)}
                  onChange={(value) => updateFilter(filter.key, value)}
                />
              ))}
              {tool.folders && (
                // Searched rather than scrolled, because a hundred folders is a long list to open
                <SearchableSelectFilter
                  label={tool.folders.label}
                  allLabel={PROMPT_FOLDER_MESSAGES.allFolders}
                  searchPlaceholder={PROMPT_FOLDER_MESSAGES.searchFolders}
                  emptyLabel={PROMPT_FOLDER_MESSAGES.noFolderMatch}
                  value={filters.folder}
                  options={[
                    // Everything that is filed, whichever folder it is in, before the folders themselves
                    { id: IN_ANY_FOLDER, label: filedLabel(folders.folders) },
                    { id: UNFILED_FOLDER, label: PROMPT_FOLDER_MESSAGES.unfiled },
                    // Typing matches the folder's name, never the count beside it
                    ...(folders.folders ?? []).map((folder) => ({
                      id: folder.id,
                      label: `${folder.name} (${folder.promptCount})`,
                      searchText: folder.name,
                    })),
                  ]}
                  onChange={(value) => updateFilter("folder", value)}
                />
              )}
              <DateRangeFilters
                fromLabel="Written from"
                toLabel="Written to"
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
                <button
                  type="button"
                  onClick={() => setReloadAttempt((attempt) => attempt + 1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !result ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading {tool.noun.many}...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <History size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">
                  {hasFilters ? `No ${tool.noun.many} match these filters.` : `Nothing written yet. Every ${tool.noun.one} you write lands here.`}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                {(actionError || error) && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {actionError ?? error}
                  </p>
                )}

                {canOpenAny && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] text-on-surface-variant">
                      {tool.hideTexts
                        ? allOpen
                          ? `${capitalize(tool.noun.many)} are showing.`
                          : `${capitalize(tool.noun.many)} are hidden. Show them all, or one row at a time.`
                        : allOpen
                          ? `Every ${tool.noun.one} is shown in full.`
                          : `Long ${tool.noun.many} are cut to a few lines. Open them all, or one row at a time.`}
                    </p>
                    <button type="button" onClick={toggleAll} aria-pressed={allOpen} className={toolbarButton}>
                      {tool.hideTexts ? (
                        allOpen ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />
                      ) : allOpen ? (
                        <ChevronsDownUp size={14} aria-hidden="true" />
                      ) : (
                        <ChevronsUpDown size={14} aria-hidden="true" />
                      )}
                      {tool.hideTexts ? `${allOpen ? "Hide" : "Show"} ${tool.noun.many}` : allOpen ? "Collapse all" : "Expand all"}
                    </button>
                  </div>
                )}

                {/* The table from xl, where it fits beside the open sidebar without scrolling sideways; cards below */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[900px] border-collapse text-left [overflow-wrap:anywhere]">
                    <caption className="sr-only">
                      {tool.heading}, page {page} of {totalPages}
                    </caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {[tool.titleHeading, "Details", capitalize(tool.noun.one), "Written", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => (
                        <tr key={item.id} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="w-[190px] max-w-[220px] px-3 py-2.5 2xl:w-[230px] 2xl:max-w-[250px]">
                            <p className="break-words text-[13px] font-semibold text-on-surface">{item.title}</p>
                            {item.subtitle && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">{item.subtitle}</p>}
                          </td>
                          <td className="w-[140px] max-w-[170px] px-3 py-2.5 2xl:w-[170px] 2xl:max-w-[190px]">
                            <RecordTags item={item} />
                          </td>
                          <td className="min-w-[220px] px-3 py-2 2xl:min-w-[260px]">
                            <TextsCell tool={tool} item={item} isOpen={isOpen(item.id)} onToggle={() => toggleRow(item.id)} />
                          </td>
                          <td className="w-[104px] px-3 py-2.5 text-[12px] text-on-surface-variant 2xl:w-auto 2xl:whitespace-nowrap">{writtenOn(item.createdAt)}</td>
                          <td className="w-[190px] px-3 py-2 2xl:w-[270px]">{actions(item, "grid")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards on a phone, two to a row on a tablet or a narrow laptop */}
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {visibleItems.map((item) => (
                    <li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold text-on-surface">{item.title}</p>
                        {item.subtitle && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-on-surface-variant">{item.subtitle}</p>}
                      </div>
                      {item.choices.length + item.details.length > 0 && <RecordTags item={item} />}
                      <TextsCell tool={tool} item={item} isOpen={isOpen(item.id)} onToggle={() => toggleRow(item.id)} />
                      <div className="flex flex-col gap-1 border-t border-outline-variant/70 pt-2">
                        <span className="text-[11px] text-outline">{writtenOn(item.createdAt)}</span>
                        {/* Pulled left only, so a long action never hangs over the right edge of the card */}
                        <div className="-ml-2">{actions(item, "row")}</div>
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

      {viewing && <RecordDialog item={viewing} loadDetail={loadDetail} onClose={() => setViewing(null)} />}
      {moving && (
        <MoveToFolderDialog
          title={moving.title}
          folders={folders.folders}
          currentFolderId={moving.folder?.id ?? null}
          onMove={(folder) => moveRecord(moving, folder)}
          onCreate={folders.create}
          onClose={() => setMoving(null)}
        />
      )}
      {isManagingFolders && (
        <FoldersDialog
          folders={folders.folders}
          onCreate={folders.create}
          onRename={folders.rename}
          onDelete={async (id) => {
            await folders.remove(id)
            // Records that were in it are now in none, and the filter can no longer point at it
            if (filters.folder === id) updateFilter("folder", "")
            else setReloadAttempt((attempt) => attempt + 1)
          }}
          onClose={() => setIsManagingFolders(false)}
        />
      )}
    </div>
  )
}
