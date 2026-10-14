"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, FilePlus2, FolderKanban, Loader2, RefreshCw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { ProjectTasks, deleteItemTitle } from "@/components/client-projects/ProjectTasks"
import { ProjectTabs } from "@/components/client-projects/ProjectTabs"
import { countsOf, reorderItems } from "@/lib/projectItems"
import { TaskComposer } from "@/components/client-projects/TaskComposer"
import { ProjectLinkPanel } from "@/components/client-projects/ProjectLinkPanel"
import { ProjectFolderTree, folderBranch, folderPath } from "@/components/client-projects/ProjectFolderTree"
import { FolderNameDialog, MoveToFolderDialog, WriteDocumentDialog } from "@/components/client-projects/ProjectFolderDialogs"
import { MoveToTabDialog } from "@/components/client-projects/MoveToTabDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { filterByWords } from "@/lib/nameSearch"
import {
  CLIENT_PROJECTS_ENDPOINT,
  DEFAULT_PROJECT_ITEM_KIND,
  PROJECT_FOLDER_MESSAGES,
  PROJECT_TASK_MESSAGES,
  hasFolders,
  isMovableItemKind,
  type ProjectItemKind,
  type ProjectPriority,
} from "@/constants/clientProjectTasks"
import type { ProjectFolder, ProjectTask, ProjectTaskInput, ProjectWithTasks } from "@/types/clientProjectTasks"

interface ProjectDetailClientProps {
  projectId: string
}

/**
 * One client project, with everything on it: the seven tabs, the composer, the folders of the two
 * tabs that have them, and the link it is shared by.
 *
 * It is its own page rather than a panel beside the list (at the owner's request), so the work has
 * the whole width and the list stays a list. The project itself (its name, what the work is, whether
 * it is running) still belongs to Clients Management; this page owns what is under it.
 */
export default function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [project, setProject] = useState<ProjectWithTasks | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Which tab is open, starting on the first one as both surfaces do
  const [tab, setTab] = useState<ProjectItemKind>(DEFAULT_PROJECT_ITEM_KIND)
  /**
   * The folders of this project, and which one is open. The Documents and Links tabs are filed in
   * folders (`hasFolders`); every other tab is a flat list, so neither the tree nor the folder
   * search is drawn on it.
   */
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderSearch, setFolderSearch] = useState("")
  const [folderBusyId, setFolderBusyId] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [isFolderSaving, setIsFolderSaving] = useState(false)
  // Which folder dialog is open: naming one, moving something, or writing a document
  const [naming, setNaming] = useState<{ renaming: ProjectFolder | null; parentId: string | null } | null>(null)
  const [movingTask, setMovingTask] = useState<ProjectTask | null>(null)
  const [movingFolder, setMovingFolder] = useState<ProjectFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<ProjectFolder | null>(null)
  const [isWriting, setIsWriting] = useState(false)
  // The item being moved to another tab, which is its own dialog
  const [movingTab, setMovingTab] = useState<ProjectTask | null>(null)
  const [editing, setEditing] = useState<ProjectTask | null>(null)
  const [deleting, setDeleting] = useState<ProjectTask | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // The project with everything on it: its items and its folders come in the one answer
  useEffect(() => {
    const controller = new AbortController()
    requestApi<{ project: ProjectWithTasks; tasks: ProjectTask[]; folders?: ProjectFolder[] }>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        setProject(data.project)
        setTasks(data.tasks)
        setFolders(data.folders ?? [])
        setError(null)
        setTaskError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [projectId, attempt])

  // The counts come from the items themselves, so every tab's number follows an add or a delete
  const counts = useMemo(() => (tasks ? countsOf(tasks) : null), [tasks])

  const addTask = async (input: ProjectTaskInput) => {
    // It goes in the folder being looked at, which is where the user expects to find it
    const body = hasFolders(input.kind ?? tab) ? { ...input, folderId } : input
    const { data } = await requestApi<ProjectTask>(
      `${CLIENT_PROJECTS_ENDPOINT}/${projectId}/tasks`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      // It creates a record and may carry images and a voice note, so a retry must not add it twice
      { idempotent: true }
    )
    setTasks((current) => [...(current ?? []), data])
  }

  const saveTask = async (task: ProjectTask, input: Partial<ProjectTaskInput>) => {
    const { data } = await requestApi<ProjectTask>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    setTasks((current) => (current ?? []).map((row) => (row.id === task.id ? data : row)))
    return data
  }

  /** Ticking a task off: the box moves at once and goes back if the write fails. */
  const tick = async (task: ProjectTask, done: boolean) => {
    const status = done ? "done" : "open"
    setBusyId(task.id)
    setTasks((current) => (current ?? []).map((row) => (row.id === task.id ? { ...row, status } : row)))
    try {
      await saveTask(task, { status })
      setTaskError(null)
    } catch (reason: unknown) {
      setTasks((current) => (current ?? []).map((row) => (row.id === task.id ? { ...row, status: task.status } : row)))
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  /** How urgent an item is: the chip changes at once and goes back if the write fails. */
  const changePriority = async (task: ProjectTask, priority: ProjectPriority) => {
    setBusyId(task.id)
    setTasks((current) => (current ?? []).map((row) => (row.id === task.id ? { ...row, priority } : row)))
    try {
      await saveTask(task, { priority })
      setTaskError(null)
    } catch (reason: unknown) {
      setTasks((current) => (current ?? []).map((row) => (row.id === task.id ? { ...row, priority: task.priority } : row)))
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  /**
   * The order a drag left a tab in. The list moves at once and the new order is sent as the ids of
   * the items shown, which is what the server writes into those same items' places; a refusal puts
   * the list back and reads the project again, since something changed somewhere else.
   */
  const reorder = async (orderedIds: string[]) => {
    const before = tasks
    setTasks((current) => (current ? reorderItems(current, orderedIds) : current))
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/tasks/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, orderedIds }),
      })
      setTaskError(null)
    } catch (reason: unknown) {
      setTasks(before)
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.reorderFailed)
      setAttempt((count) => count + 1)
    }
  }

  /** Moves one item to another tab. It keeps what it carries and takes that tab's own number. */
  const moveToTab = async (kind: ProjectItemKind) => {
    const task = movingTab
    if (!task) return
    await saveTask(task, { kind })
    setMovingTab(null)
  }

  /** Every folder call answers with the folder, so the tree follows without reading it again. */
  const reloadFolders = async () => {
    const { data } = await requestApi<{ folders: ProjectFolder[] }>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders`)
    setFolders(data.folders)
  }

  const makeFolder = async (name: string) => {
    if (!naming) return
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      if (naming.renaming) {
        await requestApi<ProjectFolder>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders/${naming.renaming.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      } else {
        const { data } = await requestApi<ProjectFolder>(
          `${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: tab, name, parentId: naming.parentId }) },
          // It creates a record, so a retry must not make the folder twice
          { idempotent: true }
        )
        // A folder just made is the one to work in
        setFolderId(data.id)
      }
      await reloadFolders()
      setNaming(null)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.createFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  /** Moves one item, or one folder, into another folder (null for the top of the tree). */
  const moveInto = async (target: string | null) => {
    const task = movingTask
    const folder = movingFolder
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      if (task) {
        await saveTask(task, { folderId: target })
        await reloadFolders()
        setMovingTask(null)
      } else if (folder) {
        await requestApi<ProjectFolder>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders/${folder.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: target }),
        })
        await reloadFolders()
        setMovingFolder(null)
      }
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.moveFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  /** Deletes a folder. What was inside comes up one level, so the items are read again. */
  const removeFolder = async () => {
    if (!deletingFolder) return
    setFolderBusyId(deletingFolder.id)
    setFolderError(null)
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders/${deletingFolder.id}`, { method: "DELETE" })
      // The folder being looked at may be the one that went, so the view goes to where it was
      if (folderId === deletingFolder.id) setFolderId(deletingFolder.parentId)
      setDeletingFolder(null)
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.deleteFailed)
    } finally {
      setFolderBusyId(null)
    }
  }

  /** Writes a .txt document in the app and files it where the user is looking. */
  const writeDocument = async (name: string, text: string) => {
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      const { data } = await requestApi<ProjectTask>(
        `${CLIENT_PROJECTS_ENDPOINT}/${projectId}/documents`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, text, folderId }) },
        // It stores a file and creates an item, so a retry must not write the document twice
        { idempotent: true }
      )
      setTasks((current) => [...(current ?? []), data])
      await reloadFolders()
      setIsWriting(false)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.writeFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  const removeTask = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/tasks/${deleting.id}`, { method: "DELETE" })
      setTasks((current) => (current ?? []).filter((row) => row.id !== deleting.id))
      setDeleting(null)
      setTaskError(null)
    } catch (reason: unknown) {
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.deleteFailed)
      setDeleting(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const backLink = (
    <Link
      href="/client-projects"
      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {PROJECT_TASK_MESSAGES.backToProjects}
    </Link>
  )

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            {backLink}

            {error ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 short:py-5 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !project ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading this project...
              </div>
            ) : (
              <>
                <div className="min-w-0">
                  <h1 className="flex items-start gap-2 break-words text-2xl font-bold text-on-surface">
                    <FolderKanban size={24} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
                    {project.name}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                    <span>For {project.clientName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        project.status === "completed" ? "bg-success-container text-on-success-container" : "bg-secondary-fixed text-on-secondary-fixed-variant"
                      }`}
                    >
                      {project.status === "completed" ? "Completed" : "Active"}
                    </span>
                  </p>
                  {project.description && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-on-surface-variant">{project.description}</p>}
                </div>

                <ProjectLinkPanel
                  projectId={project.id}
                  token={project.publicToken}
                  onChanged={(token) => setProject((current) => (current ? { ...current, publicToken: token } : current))}
                />

                <ProjectTabs
                  chosen={tab}
                  onChoose={(next) => {
                    setTab(next)
                    // Each tab has its own folders, so changing tab opens that tab at the top
                    setFolderId(null)
                    setFolderSearch("")
                  }}
                  counts={counts ?? project.counts}
                />

                <div id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`} className="flex min-w-0 flex-col gap-3">
                  {/* Keyed by the tab, so each one opens its own empty form rather than what
                      was half written on another */}
                  <TaskComposer key={tab} task={null} kind={tab} onSave={addTask} fileEndpoint={`${CLIENT_PROJECTS_ENDPOINT}/${project.id}/files`} />

                  {taskError && (
                    <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                      {taskError}
                    </p>
                  )}

                  {tasks === null ? (
                    <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
                      <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                      Loading what is on this project...
                    </p>
                  ) : !hasFolders(tab) ? (
                    /* The tabs that are a conversation about the work stay a flat list */
                    <ProjectTasks
                      tasks={tasks.filter((task) => task.kind === tab)}
                      kind={tab}
                      busyId={busyId}
                      onTick={tick}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onMoveTab={isMovableItemKind(tab) ? setMovingTab : undefined}
                      onPriority={changePriority}
                      onReorder={reorder}
                      clientTag={PROJECT_TASK_MESSAGES.fromClient}
                    />
                  ) : (
                    (() => {
                      const tabFolders = folders.filter((folder) => folder.kind === tab)
                      const branch = folderBranch(tabFolders, folderId)
                      const ofTab = tasks.filter((task) => task.kind === tab)
                      const inHere = ofTab.filter((task) => branch.has(task.folderId ?? null))
                      const searched = folderSearch.trim()
                        ? filterByWords(inHere, folderSearch, (task) => `${task.content} ${task.url} ${task.files.map((file) => file.name).join(" ")}`)
                        : inHere
                      const path = folderPath(tabFolders, folderId)
                      return (
                        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                          <div className="min-w-0 rounded-2xl border border-outline-variant bg-white p-2">
                            <ProjectFolderTree
                              folders={tabFolders}
                              selectedId={folderId}
                              rootCount={ofTab.filter((task) => !task.folderId).length}
                              busyId={folderBusyId}
                              onSelect={(id) => {
                                setFolderId(id)
                                setFolderSearch("")
                              }}
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
                            />
                          </div>

                          <div className="flex min-w-0 flex-col gap-3">
                            {/* Where the list is, and the two things to do here: search it, or
                                write a document straight into it */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 text-[12px] text-on-surface-variant">
                                <span className="font-semibold text-on-surface">
                                  {path.length === 0 ? PROJECT_FOLDER_MESSAGES.root : path.map((folder) => folder.name).join(" / ")}
                                </span>
                                {path.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setMovingFolder(path[path.length - 1])}
                                    className="ml-2 font-semibold text-primary hover:underline"
                                  >
                                    {PROJECT_FOLDER_MESSAGES.move}
                                  </button>
                                )}
                              </p>
                              {tab === "document" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFolderError(null)
                                    setIsWriting(true)
                                  }}
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                                >
                                  <FilePlus2 size={14} aria-hidden="true" />
                                  {PROJECT_FOLDER_MESSAGES.write}
                                </button>
                              )}
                            </div>

                            <div>
                              <input
                                value={folderSearch}
                                onChange={(event) => setFolderSearch(event.target.value)}
                                placeholder={PROJECT_FOLDER_MESSAGES.searchHere}
                                aria-label={PROJECT_FOLDER_MESSAGES.searchHere}
                                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
                              />
                              <p className="mt-1 text-[11px] text-outline">{PROJECT_FOLDER_MESSAGES.searchScope}</p>
                            </div>

                            {folderError && (
                              <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                                {folderError}
                              </p>
                            )}

                            {searched.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">
                                {folderSearch.trim() ? PROJECT_FOLDER_MESSAGES.noMatch : PROJECT_FOLDER_MESSAGES.empty}
                              </p>
                            ) : (
                              <ProjectTasks
                                tasks={searched}
                                kind={tab}
                                          busyId={busyId}
                                onTick={tick}
                                onEdit={setEditing}
                                onDelete={setDeleting}
                                onMove={(task) => {
                                  setFolderError(null)
                                  setMovingTask(task)
                                }}
                                onPriority={changePriority}
                                // A search or a folder shows part of the tab, and the order written is
                                // of exactly what is on screen, which is what the server expects
                                onReorder={reorder}
                                clientTag={PROJECT_TASK_MESSAGES.fromClient}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {naming && (
        <FolderNameDialog
          folders={folders.filter((folder) => folder.kind === tab)}
          renaming={naming.renaming}
          parentId={naming.parentId}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(name) => void makeFolder(name)}
          onClose={() => {
            if (isFolderSaving) return
            setNaming(null)
            setFolderError(null)
          }}
        />
      )}

      {(movingTask || movingFolder) && (
        <MoveToFolderDialog
          folders={folders.filter((folder) => folder.kind === (movingTask?.kind ?? movingFolder?.kind ?? tab))}
          what={movingTask ? movingTask.content : (movingFolder?.name ?? "")}
          movingFolderId={movingFolder?.id ?? null}
          currentFolderId={movingTask ? movingTask.folderId : (movingFolder?.parentId ?? null)}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(target) => void moveInto(target)}
          onClose={() => {
            if (isFolderSaving) return
            setMovingTask(null)
            setMovingFolder(null)
            setFolderError(null)
          }}
        />
      )}

      {movingTab && <MoveToTabDialog task={movingTab} onMove={moveToTab} onClose={() => setMovingTab(null)} />}

      {isWriting && (
        <WriteDocumentDialog
          folders={folders.filter((folder) => folder.kind === "document")}
          folderId={folderId}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(name, text) => void writeDocument(name, text)}
          onClose={() => {
            if (isFolderSaving) return
            setIsWriting(false)
            setFolderError(null)
          }}
        />
      )}

      {deletingFolder && (
        <Modal
          title={`Delete the folder ${deletingFolder.name}?`}
          description={PROJECT_FOLDER_MESSAGES.deleteExplains}
          onClose={() => setDeletingFolder(null)}
          isCloseDisabled={folderBusyId === deletingFolder.id}
          size="compact"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                disabled={folderBusyId === deletingFolder.id}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void removeFolder()}
                disabled={folderBusyId === deletingFolder.id}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-60"
              >
                {folderBusyId === deletingFolder.id && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete the folder
              </button>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-on-surface-variant">
            {deletingFolder.totalItemCount > 0
              ? `${deletingFolder.totalItemCount} ${deletingFolder.totalItemCount === 1 ? "item is" : "items are"} filed in it. ${PROJECT_FOLDER_MESSAGES.deleteExplains}`
              : PROJECT_FOLDER_MESSAGES.deleteExplains}
          </p>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit" onClose={() => setEditing(null)} size="large">
          <TaskComposer
            task={editing}
            kind={editing.kind}
            fileEndpoint={`${CLIENT_PROJECTS_ENDPOINT}/${editing.projectId}/files`}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await saveTask(editing, input)
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title={deleteItemTitle(deleting.kind)}
          description={deleting.content}
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeTask}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">{PROJECT_TASK_MESSAGES.deleteExplains}</p>
        </Modal>
      )}
    </div>
  )
}
