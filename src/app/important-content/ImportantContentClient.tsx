"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, Eye, FileKey2, FolderOpen, Folders, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { Pagination } from "@/components/ui/Pagination"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { useRowSelection } from "@/hooks/useRowSelection"
import { FilterPanel, SearchFilter, SearchableSelectFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { ContentDialog } from "@/components/important-content/ContentDialog"
import { ContentFullView } from "@/components/important-content/ContentFullView"
import { FoldersDialog } from "@/components/saved-outputs/FoldersDialog"
import { MoveToFolderDialog } from "@/components/saved-outputs/MoveToFolderDialog"
import { usePromptFolders } from "@/hooks/usePromptFolders"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { requestApi } from "@/lib/apiClient"
import { toPlainText } from "@/lib/richText"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { CONTENT_PREVIEW_MAX_LENGTH, IMPORTANT_CONTENT_ENDPOINT, IMPORTANT_CONTENT_MESSAGES } from "@/constants/importantContent"
import {
  CONTENT_FOLDERS_ENDPOINT,
  CONTENT_FOLDER_COPY,
  CONTENT_FOLDER_MESSAGES,
  IN_ANY_FOLDER,
  UNFILED_FOLDER,
} from "@/constants/contentFolders"
import type { RecordFolder } from "@/types/folders"
import type { ImportantContent, ImportantContentPage } from "@/types/importantContent"

const savedOn = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/**
 * The list shows the words, not the formatting marks, and not the line breaks either: a few lines
 * of a clamped preview are worth more filled with words than left short by the newlines of a list
 * or a code block. View details shows the description as it was written.
 */
const preview = (description: string) => {
  const text = toPlainText(description).replace(/\s+/g, " ").trim()
  return text.length > CONTENT_PREVIEW_MAX_LENGTH ? `${text.slice(0, CONTENT_PREVIEW_MAX_LENGTH).trimEnd()}...` : text
}

// Copy takes the saved text; an entry with no description copies its name. Switched off with the
// row's Copy button at the owner's request, and kept here so putting that button back is one line.
// const copyText = (entry: ImportantContent) => entry.description || entry.name

const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
const actionButton =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** Which folder an entry is in, or that it is in none, wherever a row is shown. */
const FolderTag: React.FC<{ folder: ImportantContent["folder"] }> = ({ folder }) =>
  folder ? (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
      <FolderOpen size={11} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{folder.name}</span>
    </span>
  ) : (
    <span className="text-[11px] text-outline">{CONTENT_FOLDER_MESSAGES.unfiled}</span>
  )

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
  // A folder's id, IN_ANY_FOLDER, UNFILED_FOLDER, or "" for every entry
  const [folder, setFolder] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ImportantContentPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState<{ entry: ImportantContent | null } | null>(null)
  // The entry opened in full; its description comes with the list, so opening it asks for nothing
  const [viewing, setViewing] = useState<ImportantContent | null>(null)
  const [deleting, setDeleting] = useState<ImportantContent | null>(null)
  // Filing: the entry being moved, and whether the folder manager is open
  const [moving, setMoving] = useState<ImportantContent | null>(null)
  const [isManagingFolders, setIsManagingFolders] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Deleting several at once: which delete is waiting to be confirmed, and whether it is running
  const [confirmingMany, setConfirmingMany] = useState<"picked" | "all" | null>(null)
  const [isDeletingMany, setIsDeletingMany] = useState(false)

  // One folder list for the filter, the Move dialog and the manager, loaded once per page
  const folders = usePromptFolders(CONTENT_FOLDERS_ENDPOINT)

  // Typing settles before the list is asked for again, and an emptied search box counts at once
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (type) params.set("type", type)
  if (folder) params.set("folder", folder)
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
  const hasFilters = Boolean(search || type || folder)
  const selection = useRowSelection((result?.items ?? []).map((entry) => entry.id))

  /**
   * Deletes the ticked entries, or every entry the search and type cover, in one call. Deleting is
   * final, so it only runs from the confirmation. The list is read again from the first page.
   */
  const deleteMany = async (which: "picked" | "all") => {
    if (isDeletingMany) return
    setIsDeletingMany(true)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: number }>(`${IMPORTANT_CONTENT_ENDPOINT}?${query}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "picked" ? { ids: [...selection.pickedIds] } : { all: true }),
      })
      selection.clear()
      setConfirmingMany(null)
      setPage(1)
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : IMPORTANT_CONTENT_MESSAGES.deleteFailed)
      setConfirmingMany(null)
    } finally {
      setIsDeletingMany(false)
    }
  }
  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pageSize = result?.pageSize ?? 0
  const totalPages = result?.totalPages ?? 1
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = Math.min(total, (page - 1) * pageSize + items.length)
  // A type chosen in the filter stays offered even if its last entry was just edited away
  const typeOptions = [...new Set([...(result?.types ?? []), ...(type ? [type] : [])])].map((entry) => ({ id: entry, label: entry }))
  // "In a folder" carries the number filed, the folder counts added up, like the saved-outputs filter
  const filedCount = (folders.folders ?? []).reduce((count, entry) => count + entry.recordCount, 0)
  const folderOptions = [
    { id: IN_ANY_FOLDER, label: `${CONTENT_FOLDER_MESSAGES.inAnyFolder} (${filedCount})`, searchText: CONTENT_FOLDER_MESSAGES.inAnyFolder },
    { id: UNFILED_FOLDER, label: CONTENT_FOLDER_MESSAGES.unfiled, searchText: CONTENT_FOLDER_MESSAGES.unfiled },
    ...(folders.folders ?? []).map((entry) => ({ id: entry.id, label: `${entry.name} (${entry.recordCount})`, searchText: entry.name })),
  ]

  // The list is ordered by last change, so a new entry and an edited one both land at the top of page 1
  const saved = () => {
    setDialog(null)
    setPage(1)
    reload()
  }

  /**
   * Files one entry in a folder, or takes it out of one. The row shows it at once; a failure says so
   * and the list is read again, so the tag can never claim a folder the entry is not in. A folder
   * filter is on the page, so the entry may now belong on another page: the list is reloaded then.
   */
  const move = async (entry: ImportantContent, into: RecordFolder | null) => {
    const from = entry.folder?.id ?? null
    setMoveError(null)
    setResult((current) =>
      current ? { ...current, items: current.items.map((row) => (row.id === entry.id ? { ...row, folder: into ? { id: into.id, name: into.name } : null } : row)) } : current
    )
    try {
      await requestApi<ImportantContent>(`${IMPORTANT_CONTENT_ENDPOINT}/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: into?.id ?? null }),
      })
      folders.countMoved(from, into?.id ?? null)
      if (folder) reload()
    } catch (reason: unknown) {
      setMoveError(reason instanceof Error ? reason.message : CONTENT_FOLDER_MESSAGES.moveFailed)
      reload()
      throw reason
    }
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
      {/* Copy is switched off here at the owner's request; the full view still has its copy button.
          <CopyButton text={copyText(entry)} label={`Copy ${entry.name}`} showLabel /> */}
      <button type="button" onClick={() => setMoving(entry)} aria-label={`Move ${entry.name} to a folder`} className={`${actionButton} hover:text-primary`}>
        <FolderOpen size={13} aria-hidden="true" />
        Move
      </button>
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
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setIsManagingFolders(true)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Folders size={16} aria-hidden="true" />
                  Folders
                  {folders.folders && folders.folders.length > 0 && <span className="text-[12px] font-medium text-outline">{folders.folders.length}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ entry: null })}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add New Content
                </button>
              </div>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={() => {
                setSearch("")
                setType("")
                setFolder("")
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
              {/* Searched rather than scrolled, because a hundred folders is a long list to open */}
              <SearchableSelectFilter
                label="Folder"
                allLabel={CONTENT_FOLDER_MESSAGES.allFolders}
                value={folder}
                options={folderOptions}
                searchPlaceholder={CONTENT_FOLDER_MESSAGES.searchFolders}
                emptyLabel={CONTENT_FOLDER_MESSAGES.noFolderMatch}
                onChange={(value) => {
                  setFolder(value)
                  setPage(1)
                }}
              />
            </FilterPanel>

            {result && total > 0 && (
              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={total}
                noun={{ one: "entry", many: "entries" }}
                hasFilters={hasFilters}
                isBusy={isDeletingMany}
                onDeletePicked={() => setConfirmingMany("picked")}
                onDeleteAll={() => setConfirmingMany("all")}
                onClear={selection.clear}
              />
            )}

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
                {(error || moveError || folders.error) && (
                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                    {error ?? moveError ?? folders.error}
                  </p>
                )}

                {/* The table from xl, where it fits beside the open sidebar; cards below, two to a row on a tablet */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <caption className="sr-only">Important content, page {page} of {totalPages}</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        <th scope="col" className="w-[36px] px-2 py-2.5">
                          <span className="sr-only">Picked</span>
                        </th>
                        {/* "Last changed" was taken off at the owner's request; the list is still ordered by it */}
                        {["Name", "Type", "Folder", "Description", "Actions"].map((heading) => (
                          <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass} ${heading === "Actions" ? "text-right" : ""}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((entry) => (
                        <tr key={entry.id} className="border-b border-outline-variant/60 align-top last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="w-[36px] px-2 py-2.5">
                            <input
                              type="checkbox"
                              checked={selection.isPicked(entry.id)}
                              disabled={isDeletingMany}
                              onChange={(event) => selection.pick(entry.id, (event.nativeEvent as MouseEvent).shiftKey)}
                              aria-label={`Pick ${entry.name}`}
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
                          <td className="max-w-[240px] px-3 py-2.5">
                            <p className="break-words text-[13px] font-semibold text-on-surface">{entry.name}</p>
                          </td>
                          <td className="max-w-[160px] px-3 py-2.5">
                            <TypeBadge type={entry.type} />
                          </td>
                          <td className="max-w-[150px] px-3 py-2.5">
                            <FolderTag folder={entry.folder} />
                          </td>
                          <td className="max-w-[420px] px-3 py-2.5">
                            {entry.description ? (
                              <p className="line-clamp-3 break-words text-[13px] leading-relaxed text-on-surface-variant">{preview(entry.description)}</p>
                            ) : (
                              <span className="text-[12px] text-outline">No description</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{actions(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {items.map((entry) => (
                    <li key={entry.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <input
                        type="checkbox"
                        checked={selection.isPicked(entry.id)}
                        disabled={isDeletingMany}
                        onChange={(event) => selection.pick(entry.id, (event.nativeEvent as MouseEvent).shiftKey)}
                        aria-label={`Pick ${entry.name}`}
                        className="h-4 w-4 self-start accent-primary"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-[14px] font-semibold text-on-surface">{entry.name}</p>
                        </div>
                        <TypeBadge type={entry.type} />
                      </div>
                      <FolderTag folder={entry.folder} />
                      {entry.description && (
                        <p className="line-clamp-4 break-words text-[13px] leading-relaxed text-on-surface-variant">{preview(entry.description)}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-outline-variant/70 pt-2">
                        <span className="whitespace-nowrap text-[11px] text-outline">{savedOn(entry.updatedAt)}</span>
                        {actions(entry)}
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isLoading={isLoading} />
              </div>
            )}
          </div>
        </main>
      </div>

      {confirmingMany && (
        <ConfirmBulkDelete
          count={confirmingMany === "picked" ? selection.pickedIds.size : total}
          noun={{ one: "entry", many: "entries" }}
          alsoGoes={confirmingMany === "all" && hasFilters ? "Everything matching the filters goes, including entries on the other pages." : undefined}
          isDeleting={isDeletingMany}
          onConfirm={() => void deleteMany(confirmingMany)}
          onClose={() => setConfirmingMany(null)}
        />
      )}
      {viewing && (
        <ContentFullView
          entry={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null)
            setDialog({ entry: viewing })
          }}
        />
      )}

      {moving && (
        <MoveToFolderDialog
          title={moving.name}
          folders={folders.folders}
          currentFolderId={moving.folder?.id ?? null}
          copy={CONTENT_FOLDER_COPY}
          onMove={(into) => move(moving, into)}
          onCreate={folders.create}
          onClose={() => setMoving(null)}
        />
      )}

      {isManagingFolders && (
        <FoldersDialog
          folders={folders.folders}
          copy={CONTENT_FOLDER_COPY}
          onCreate={folders.create}
          onRename={folders.rename}
          onDelete={async (id) => {
            await folders.remove(id)
            // The entries in it are kept and now show under No folder, so the list is read again
            if (folder === id) setFolder("")
            reload()
          }}
          onClose={() => setIsManagingFolders(false)}
        />
      )}

      {dialog && (
        <ContentDialog
          entry={dialog.entry}
          knownTypes={result?.types ?? []}
          // An edit that auto-saved on the way is a change like any other, and moves to the top
          onClose={(changed) => (changed ? saved() : setDialog(null))}
          onSaved={saved}
        />
      )}

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
