"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { FolderInput, FolderPlus, HardDrive, Loader2, Search, Upload, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { AssetGrid } from "@/components/important-files/AssetGrid"
import { DriveBreadcrumb } from "@/components/important-files/DriveBreadcrumb"
import { DriveFolderTiles } from "@/components/important-files/DriveFolderTiles"
import { FolderTree } from "@/components/folders/FolderTree"
import { FolderNameDialog, MoveToFolderDialog } from "@/components/folders/FolderDialogs"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { useRowSelection } from "@/hooks/useRowSelection"
import { useDriveFolders } from "@/hooks/useDriveFolders"
import { AddAssetDialog } from "@/components/important-files/AddAssetDialog"
import { EditAssetDialog } from "@/components/important-files/EditAssetDialog"
import { DeleteAssetDialog } from "@/components/important-files/DeleteAssetDialog"
import { AssetViewerDialog } from "@/components/important-files/AssetViewerDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { ClearFiltersButton } from "@/components/history/HistoryFilters"
import { filtersOf, oneOf, savedText, type SavedFilters } from "@/lib/savedFilters"
import { requestApi, fetchWithRetry } from "@/lib/apiClient"
import { uploadAsset } from "@/lib/assetUpload"
import { childFolders, folderPath } from "@/lib/folderTree"
import { folderFromDropId, foldersUnderPointer } from "@/lib/folderDrop"
import {
  ASSET_FILTERS,
  ASSET_SEARCH_MAX_LENGTH,
  DRIVE_FOLDER_MAX_DEPTH,
  DRIVE_FOLDER_MESSAGES,
  DRIVE_FOLDER_NAME_MAX_LENGTH,
  IMPORTANT_FILES_ENDPOINT,
  IMPORTANT_FILES_MESSAGES,
  SEARCH_DEBOUNCE_MS,
  type AssetFilterId,
} from "@/constants/importantFiles"
import type { Asset, AssetMetadataInput, AssetsPage, DriveFolder, UploadProgress } from "@/types/importantFiles"

/**
 * Personal Drive: everything the user keeps, filed in folders they make.
 *
 * It was Important Files, a flat list of everything with a search over it, and it became a drive at
 * the owner's request. The three pieces that make it one are the tree on the left, the folders of
 * the open folder drawn above its files, and the line of folders above both saying where you are.
 * Each of them is a place to **drop a file on**, so filing something is a drag, as it is in a drive;
 * Move does the same thing from a dialog, for a keyboard and for a phone.
 *
 * What a view shows is decided on the server (`services/importantFiles/assets.ts`): a folder shows
 * what is filed directly in it, and a search widens to that folder and everything inside it, so
 * searching from My Drive searches the lot.
 */

const chipClass = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors"
const headerButton =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"

export default function PersonalDriveClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  // Deleting several at once: which delete is waiting to be confirmed, and whether it is running
  const [confirmingMany, setConfirmingMany] = useState<"picked" | "all" | null>(null)
  const [isDeletingMany, setIsDeletingMany] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [typedSearch, setTypedSearch] = useState("")
  const [search, setSearch] = useState("")
  const [type, setType] = useState<AssetFilterId>("all")
  const [isAdding, setIsAdding] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [viewing, setViewing] = useState<Asset | null>(null)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const isFetchingRef = useRef(false)
  const uploadRef = useRef<AbortController | null>(null)

  // Which folder is open, null for the top of the drive, and the folders themselves
  const [folderId, setFolderId] = useState<string | null>(null)
  const {
    folders,
    rootCount,
    create: createFolder,
    change: changeFolder,
    remove: removeFolder,
    reload: reloadFolders,
  } = useDriveFolders()
  const [areFoldersShown, setAreFoldersShown] = useState(false)
  // The folder dialogs: making or renaming one, moving one, and deleting one
  const [naming, setNaming] = useState<{ renaming: DriveFolder | null; parentId: string | null } | null>(null)
  const [movingFolder, setMovingFolder] = useState<DriveFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<DriveFolder | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  // Filing files: the one being moved from its own button, or the picked ones from the bar
  const [movingAssets, setMovingAssets] = useState<Asset[] | null>(null)
  // What is being dragged, and the folder the pointer is over
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Typing settles before the search runs, so a search is one request, not one per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typedSearch.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typedSearch])

  // The search and the type are kept on the account, so the drive opens the way it was left
  // (hooks/useSavedFilters). Which folder is open is not a filter and is not kept: a drive opens at
  // the top of itself
  useSavedFilters({
    view: "personal-drive",
    filters: filtersOf({ search: typedSearch, type: type === "all" ? "" : type }),
    apply: (saved: SavedFilters) => {
      setTypedSearch(savedText(saved.search))
      setType(
        oneOf<AssetFilterId>(
          saved.type,
          ASSET_FILTERS.map((filter) => filter.id)
        ) || "all"
      )
      setIsLoading(true)
    },
  })

  // What every call about this view carries: the open folder, the search and the type filter
  const viewParams = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (type !== "all") params.set("type", type)
    params.set("folder", folderId ?? "root")
    return params
  }, [search, type, folderId])

  // The first batch: on arrival, whenever the folder, search or filter changes, and after a change
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (type !== "all") params.set("type", type)
    params.set("folder", folderId ?? "root")
    requestApi<AssetsPage>(`${IMPORTANT_FILES_ENDPOINT}?${params.toString()}`, { signal: controller.signal })
      .then(({ data }) => {
        setAssets(data.items)
        setNextCursor(data.nextCursor)
        setTotal(data.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [search, type, folderId, reloadAttempt])

  // Starts the list again from the newest file, keeping the folder, the search and the filter
  const reload = useCallback(() => {
    setIsLoading(true)
    setListError(null)
    setReloadAttempt((attempt) => attempt + 1)
  }, [])

  // A new folder, search or filter starts from the first batch again
  const changeSearch = (value: string) => {
    setTypedSearch(value)
    setIsLoading(true)
  }
  const changeType = (next: AssetFilterId) => {
    if (next === type) return
    setType(next)
    setIsLoading(true)
  }
  const clearFilters = () => {
    setTypedSearch("")
    setType("all")
    setIsLoading(true)
  }
  const openFolder = (next: string | null) => {
    if (next === folderId) return
    setFolderId(next)
    setIsLoading(true)
    selection.clear()
  }

  // The batch after the last one, appended to what is already on screen
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return
    isFetchingRef.current = true
    setIsLoadingMore(true)
    setListError(null)
    try {
      const params = viewParams()
      params.set("cursor", nextCursor)
      const { data } = await requestApi<AssetsPage>(`${IMPORTANT_FILES_ENDPOINT}?${params.toString()}`)
      setAssets((current) => {
        // A file already on screen is never added twice, whatever changed meanwhile
        const seen = new Set(current.map((asset) => asset.id))
        return [...current, ...data.items.filter((asset) => !seen.has(asset.id))]
      })
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.moreFailed)
    } finally {
      isFetchingRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor, viewParams])

  // The bytes go from the browser straight to storage; only the progress comes back here. The file
  // lands in the folder that is open, which is what a drive does with an upload
  const startUpload = async (file: File, metadata: AssetMetadataInput) => {
    uploadRef.current?.abort()
    const controller = new AbortController()
    uploadRef.current = controller
    setProgress({ stage: "preparing", percent: 0, error: null })
    try {
      await uploadAsset(file, { ...metadata, folderId }, {
        onProgress: (percent) => setProgress((current) => (current ? { ...current, percent } : current)),
        onStage: (stage) => setProgress((current) => ({ stage, percent: current?.percent ?? 0, error: null })),
        signal: controller.signal,
      })
      setProgress({ stage: "done", percent: 100, error: null })
      setIsAdding(false)
      setProgress(null)
      setNotice(IMPORTANT_FILES_MESSAGES.created)
      reload()
      reloadFolders()
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setProgress({ stage: "cancelled", percent: 0, error: null })
        return
      }
      setProgress({
        stage: "failed",
        percent: 0,
        error: error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.uploadFailed,
      })
    } finally {
      uploadRef.current = null
    }
  }

  const cancelUpload = () => uploadRef.current?.abort()

  const closeAdd = () => {
    if (progress && ["preparing", "uploading", "finishing"].includes(progress.stage)) return
    setIsAdding(false)
    setProgress(null)
  }

  const saveMetadata = async (input: AssetMetadataInput) => {
    if (!editing || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const { data } = await requestApi<Asset>(`${IMPORTANT_FILES_ENDPOINT}/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      // Only the details changed, so the file stays exactly where it is in the list
      setAssets((current) => current.map((asset) => (asset.id === data.id ? data : asset)))
      setEditing(null)
      setNotice(IMPORTANT_FILES_MESSAGES.updated)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || busyId) return
    setBusyId(pendingDelete.id)
    setDeleteError(null)
    try {
      await requestApi(`${IMPORTANT_FILES_ENDPOINT}/${pendingDelete.id}`, { method: "DELETE" })
      setAssets((current) => current.filter((asset) => asset.id !== pendingDelete.id))
      setTotal((count) => Math.max(0, count - 1))
      setPendingDelete(null)
      setNotice(IMPORTANT_FILES_MESSAGES.deleted)
      reloadFolders()
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.deleteFailed)
    } finally {
      setBusyId(null)
    }
  }

  // A fresh signed link every time, so a link that has been sitting in the page cannot go stale
  const openLink = async (asset: Asset, download: boolean) => {
    try {
      const { data } = await requestApi<{ url: string }>(
        `${IMPORTANT_FILES_ENDPOINT}/${asset.id}/link${download ? "?download=1" : ""}`
      )
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : IMPORTANT_FILES_MESSAGES.linkFailed)
    }
  }

  /** Copies what can really be copied: the text of a text file, or a PNG as an image. */
  const copyAsset = async (asset: Asset): Promise<boolean> => {
    try {
      if (asset.category === "text") {
        const { data } = await requestApi<{ text: string }>(`${IMPORTANT_FILES_ENDPOINT}/${asset.id}/text`)
        await navigator.clipboard.writeText(data.text)
        return true
      }
      if (asset.contentType === "image/png" && asset.previewUrl) {
        const blob = await (await fetchWithRetry(asset.previewUrl)).blob()
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        return true
      }
      return false
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const isFiltering = Boolean(search) || type !== "all"
  const selection = useRowSelection(assets.map((asset) => asset.id))

  /**
   * Deletes the ticked files, or every file the open folder and the filters cover, in one call. Each
   * file's object goes from storage before its record, so a file that cannot be removed stays listed
   * and the answer says so. Final, and only from the confirmation.
   */
  const deleteMany = async (which: "picked" | "all") => {
    if (isDeletingMany) return
    setIsDeletingMany(true)
    setListError(null)
    try {
      const { message } = await requestApi<{ deleted: number; failed: number }>(
        `${IMPORTANT_FILES_ENDPOINT}?${viewParams().toString()}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(which === "picked" ? { ids: [...selection.pickedIds] } : { all: true }),
        }
      )
      selection.clear()
      setConfirmingMany(null)
      setNotice(message ?? IMPORTANT_FILES_MESSAGES.deleted)
      reload()
      reloadFolders()
    } catch (reason: unknown) {
      setListError(reason instanceof Error ? reason.message : IMPORTANT_FILES_MESSAGES.deleteFailed)
      setConfirmingMany(null)
    } finally {
      setIsDeletingMany(false)
    }
  }

  /**
   * Files one file or several in a folder: from the Move dialog, from the bar above the list, and
   * from a drag onto a folder. It is one request for the lot, the cards that have left the open
   * folder go at once, and the counts on the tree are read again.
   */
  const moveFiles = useCallback(
    async (ids: string[], into: string | null) => {
      if (ids.length === 0) return
      try {
        const { data } = await requestApi<{ moved: number }>(IMPORTANT_FILES_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, folderId: into }),
        })
        // A file moved somewhere else is no longer in the folder on screen, unless it was dropped
        // back where it already was, so the list is read again rather than guessed at
        setNotice(DRIVE_FOLDER_MESSAGES.movedMany(data.moved))
        selection.clear()
        setMovingAssets(null)
        reload()
        reloadFolders()
      } catch (error: unknown) {
        setNotice(error instanceof Error ? error.message : DRIVE_FOLDER_MESSAGES.moveFailed)
      }
    },
    [reload, reloadFolders, selection]
  )

  // ---- the folders themselves -------------------------------------------------------------
  const saveFolderName = async (name: string) => {
    if (!naming || folderBusy) return
    setFolderBusy(true)
    setFolderError(null)
    try {
      if (naming.renaming) await changeFolder(naming.renaming.id, { name })
      else await createFolder(name, naming.parentId)
      setNaming(null)
    } catch (error: unknown) {
      setFolderError(error instanceof Error ? error.message : DRIVE_FOLDER_MESSAGES.createFailed)
    } finally {
      setFolderBusy(false)
    }
  }

  const moveFolder = async (into: string | null) => {
    if (!movingFolder || folderBusy) return
    setFolderBusy(true)
    setFolderError(null)
    try {
      await changeFolder(movingFolder.id, { parentId: into })
      setMovingFolder(null)
      setNotice(DRIVE_FOLDER_MESSAGES.moved)
    } catch (error: unknown) {
      setFolderError(error instanceof Error ? error.message : DRIVE_FOLDER_MESSAGES.moveFailed)
    } finally {
      setFolderBusy(false)
    }
  }

  const confirmFolderDelete = async () => {
    if (!deletingFolder || folderBusy) return
    setFolderBusy(true)
    setFolderError(null)
    try {
      const gone = deletingFolder
      await removeFolder(gone.id)
      setDeletingFolder(null)
      setNotice(DRIVE_FOLDER_MESSAGES.deleted)
      // The folder on screen has gone, so the view moves to the one it was inside
      if (folderId === gone.id) openFolder(gone.parentId)
      else reload()
    } catch (error: unknown) {
      setFolderError(error instanceof Error ? error.message : DRIVE_FOLDER_MESSAGES.deleteFailed)
    } finally {
      setFolderBusy(false)
    }
  }

  // ---- dragging a file onto a folder ------------------------------------------------------
  // A pointer has to travel before it counts as a drag, so a click on the handle is still a click
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))

  /**
   * The folder a file is filed in is **the one under the pointer**, measured as the drag happens
   * (`foldersUnderPointer`, which says why the library's own rules are not used here).
   */
  const underThePointer: CollisionDetection = ({ droppableContainers, pointerCoordinates }) => {
    if (!pointerCoordinates) return []
    const boxes = droppableContainers.flatMap((container) => {
      const rect = container.node.current?.getBoundingClientRect()
      return rect ? [{ id: String(container.id), rect }] : []
    })
    return foldersUnderPointer(boxes, pointerCoordinates).map((id) => ({ id }))
  }

  const onDragStart = ({ active }: DragStartEvent) => setDraggingId(String(active.id))
  const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    setDraggingId(null)
    setOverId(null)
    const into = over ? folderFromDropId(String(over.id)) : undefined
    // Dropped on something that is not a folder: nothing is filed by accident
    if (into === undefined) return
    const dragged = assets.find((asset) => asset.id === id)
    if (dragged && dragged.folderId === into) return
    // Dragging one of the picked files takes them all, the way every other list in the app behaves
    const ids = selection.pickedIds.has(id) ? [...selection.pickedIds] : [id]
    void moveFiles(ids, into)
  }

  const all = useMemo(() => folders ?? [], [folders])
  const path = useMemo(() => folderPath(all, folderId), [all, folderId])
  const here = useMemo(() => childFolders(all, folderId), [all, folderId])
  const dragged = draggingId ? assets.find((asset) => asset.id === draggingId) : null
  const movingCount = draggingId && selection.pickedIds.has(draggingId) ? selection.pickedIds.size : 1

  const tree = (
    <FolderTree
      folders={all}
      selectedId={folderId}
      rootCount={rootCount}
      totalOf={(folder) => folder.totalFileCount}
      copy={DRIVE_FOLDER_MESSAGES}
      maxDepth={DRIVE_FOLDER_MAX_DEPTH}
      isDroppable
      overId={overId}
      rootIcon="drive"
      onSelect={openFolder}
      onCreate={(parentId) => {
        setFolderError(null)
        setNaming({ renaming: null, parentId })
      }}
      onRename={(folder) => {
        setFolderError(null)
        setNaming({ renaming: folder, parentId: folder.parentId })
      }}
      onDelete={(folder) => {
        setFolderError(null)
        setDeletingFolder(folder)
      }}
      onMove={(folder) => {
        setFolderError(null)
        setMovingFolder(folder)
      }}
    />
  )

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <DndContext
            sensors={sensors}
            collisionDetection={underThePointer}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-6 lg:h-full lg:p-8">
              {/* Page header */}
              <div className="flex shrink-0 flex-col justify-between gap-3 xl:flex-row xl:items-center">
                <div className="min-w-0">
                  <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                    <HardDrive size={24} className="shrink-0 text-primary" aria-hidden="true" />
                    Personal Drive
                  </h1>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Your images, documents, videos and audio, in folders you make and names you choose.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFolderError(null)
                      setNaming({ renaming: null, parentId: folderId })
                    }}
                    className={headerButton}
                  >
                    <FolderPlus size={16} aria-hidden="true" />
                    {DRIVE_FOLDER_MESSAGES.newFolder}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                  >
                    <Upload size={16} aria-hidden="true" />
                    Upload file
                  </button>
                </div>
              </div>

              {/* Where you are, and the way back up; each step takes a file dropped on it */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <DriveBreadcrumb path={path} overId={overId} onOpen={openFolder} />
                <button
                  type="button"
                  onClick={() => setAreFoldersShown((shown) => !shown)}
                  aria-expanded={areFoldersShown}
                  className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant transition-colors hover:text-primary lg:hidden"
                >
                  {areFoldersShown ? "Hide folders" : "All folders"}
                </button>
              </div>

              {/* Search and type filters */}
              <div className="flex shrink-0 flex-col gap-2">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
                  <input
                    type="search"
                    value={typedSearch}
                    onChange={(event) => changeSearch(event.target.value)}
                    maxLength={ASSET_SEARCH_MAX_LENGTH}
                    placeholder={folderId ? DRIVE_FOLDER_MESSAGES.searchHere : DRIVE_FOLDER_MESSAGES.everywhere}
                    aria-label="Search your files by name"
                    className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-9 pr-9 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {typedSearch && (
                    <button
                      type="button"
                      onClick={() => changeSearch("")}
                      aria-label="Clear the search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-outline transition-colors hover:bg-surface-container hover:text-primary"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {search && (
                  <p className="text-[11px] text-outline">
                    {folderId ? DRIVE_FOLDER_MESSAGES.searchScope : DRIVE_FOLDER_MESSAGES.searchScopeAll}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by file type">
                  {ASSET_FILTERS.map((filter) => {
                    const Icon = filter.icon
                    const isActive = type === filter.id
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => changeType(filter.id as AssetFilterId)}
                        aria-pressed={isActive}
                        className={`${chipClass} ${
                          isActive
                            ? "bg-primary-container text-on-primary-container"
                            : "border border-outline-variant bg-white text-on-surface-variant hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        <Icon size={13} aria-hidden="true" />
                        {filter.label}
                      </button>
                    )
                  })}
                  <span className="ml-auto text-[11px] text-outline" aria-live="polite">
                    {total.toLocaleString()} {total === 1 ? "file" : "files"}
                    {isFiltering && " match"}
                  </span>
                  {(typedSearch !== "" || type !== "all") && <ClearFiltersButton onClear={clearFilters} />}
                </div>
              </div>

              {notice && (
                <p role="status" className="shrink-0 rounded-xl bg-primary-container px-3 py-2 text-[12px] font-semibold text-on-primary-container">
                  {notice}
                </p>
              )}

              {/* Moving the picked files sits beside deleting them, since both act on the ticks */}
              {selection.pickedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setMovingAssets(assets.filter((asset) => selection.pickedIds.has(asset.id)))}
                  className={`${headerButton} shrink-0 self-start py-2`}
                >
                  <FolderInput size={15} aria-hidden="true" />
                  Move {selection.pickedIds.size} picked to a folder
                </button>
              )}

              <BulkDeleteBar
                pickedCount={selection.pickedIds.size}
                total={total}
                noun={{ one: "file", many: "files" }}
                hasFilters={isFiltering || folderId !== null}
                isBusy={isDeletingMany}
                onDeletePicked={() => setConfirmingMany("picked")}
                onDeleteAll={() => setConfirmingMany("all")}
                onClear={selection.clear}
              />

              {/* The tree beside the folder's own contents; below lg the tree is shown on demand */}
              {/* 260px is what a folder five deep needs before its name starts to truncate */}
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                <aside
                  className={`${areFoldersShown ? "flex" : "hidden"} min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-2 lg:flex`}
                >
                  {tree}
                </aside>

                <AssetGrid
                  assets={assets}
                  isLoading={isLoading}
                  isLoadingMore={isLoadingMore}
                  hasMore={Boolean(nextCursor)}
                  error={listError}
                  isFiltering={isFiltering}
                  busyId={busyId}
                  pickedIds={selection.pickedIds}
                  onPick={selection.pick}
                  onRetry={reload}
                  onLoadMore={loadMore}
                  onView={setViewing}
                  onDownload={(asset) => void openLink(asset, true)}
                  onCopy={copyAsset}
                  onMove={(asset) => setMovingAssets([asset])}
                  emptyText={folderId ? DRIVE_FOLDER_MESSAGES.empty : DRIVE_FOLDER_MESSAGES.emptyRoot}
                  beforeItems={<DriveFolderTiles folders={here} overId={overId} onOpen={openFolder} />}
                  onEdit={(asset) => {
                    setSaveError(null)
                    setEditing(asset)
                  }}
                  onDelete={(asset) => {
                    setDeleteError(null)
                    setPendingDelete(asset)
                  }}
                />
              </div>
            </div>

            {/* What travels with the pointer, so it is always clear what a drop will file */}
            <DragOverlay dropAnimation={null}>
              {dragged && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-primary bg-white px-3 py-2 text-[12px] font-semibold text-on-surface shadow-lg">
                  <FolderInput size={14} className="text-primary" aria-hidden="true" />
                  {movingCount > 1 ? `${movingCount} files` : dragged.name}
                </span>
              )}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {isAdding && (
        <AddAssetDialog
          progress={progress}
          folderName={path.length > 0 ? path[path.length - 1].name : DRIVE_FOLDER_MESSAGES.root}
          onUpload={startUpload}
          onCancelUpload={cancelUpload}
          onClose={closeAdd}
        />
      )}
      {confirmingMany && (
        <ConfirmBulkDelete
          count={confirmingMany === "picked" ? selection.pickedIds.size : total}
          noun={{ one: "file", many: "files" }}
          alsoGoes="Each file is removed from storage as well; anything that cannot be removed stays listed."
          isDeleting={isDeletingMany}
          onConfirm={() => void deleteMany(confirmingMany)}
          onClose={() => setConfirmingMany(null)}
        />
      )}
      {viewing && (
        <AssetViewerDialog asset={viewing} onDownload={(asset) => void openLink(asset, true)} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <EditAssetDialog
          asset={editing}
          isSaving={isSaving}
          error={saveError}
          onSave={saveMetadata}
          onClose={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <DeleteAssetDialog
          asset={pendingDelete}
          isDeleting={busyId === pendingDelete.id}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {naming && (
        <FolderNameDialog
          folders={all}
          renaming={naming.renaming}
          parentId={naming.parentId}
          isSaving={folderBusy}
          error={folderError}
          copy={DRIVE_FOLDER_MESSAGES}
          maxLength={DRIVE_FOLDER_NAME_MAX_LENGTH}
          onSubmit={(name) => void saveFolderName(name)}
          onClose={() => setNaming(null)}
        />
      )}
      {movingFolder && (
        <MoveToFolderDialog
          folders={all}
          what={`the folder ${movingFolder.name}`}
          movingFolderId={movingFolder.id}
          currentFolderId={movingFolder.parentId}
          isSaving={folderBusy}
          error={folderError}
          copy={DRIVE_FOLDER_MESSAGES}
          onSubmit={(into) => void moveFolder(into)}
          onClose={() => setMovingFolder(null)}
        />
      )}
      {movingAssets && (
        <MoveToFolderDialog
          folders={all}
          what={movingAssets.length === 1 ? movingAssets[0].name : `${movingAssets.length} files`}
          currentFolderId={movingAssets.length === 1 ? movingAssets[0].folderId : folderId}
          isSaving={false}
          error={null}
          copy={DRIVE_FOLDER_MESSAGES}
          onSubmit={(into) => void moveFiles(movingAssets.map((asset) => asset.id), into)}
          onClose={() => setMovingAssets(null)}
        />
      )}
      {deletingFolder && (
        <Modal
          title={`Delete the folder ${deletingFolder.name}?`}
          description={DRIVE_FOLDER_MESSAGES.deleteExplains}
          onClose={() => setDeletingFolder(null)}
          isCloseDisabled={folderBusy}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                disabled={folderBusy}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmFolderDelete()}
                disabled={folderBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-60"
              >
                {folderBusy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete folder
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-on-surface-variant">
              {deletingFolder.totalFileCount > 0
                ? `${deletingFolder.totalFileCount} ${deletingFolder.totalFileCount === 1 ? "file is" : "files are"} filed in here. None of them is deleted.`
                : "Nothing is filed in here."}
            </p>
            <button
              type="button"
              onClick={() => {
                setMovingFolder(deletingFolder)
                setDeletingFolder(null)
              }}
              className="self-start text-[13px] font-semibold text-primary underline hover:no-underline"
            >
              Move this folder somewhere else instead
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
