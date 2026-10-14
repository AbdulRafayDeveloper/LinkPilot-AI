"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { FolderKanban, Loader2, PencilLine } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { ProjectTasks, deleteItemTitle } from "@/components/client-projects/ProjectTasks"
import { ProjectTabs } from "@/components/client-projects/ProjectTabs"
import { countsOf, reorderItems } from "@/lib/projectItems"
import { TaskComposer } from "@/components/client-projects/TaskComposer"
import { MoveToTabDialog } from "@/components/client-projects/MoveToTabDialog"
import { requestApi } from "@/lib/apiClient"
import { SITE_LOGO_PNG, SITE_NAME } from "@/config/site"
import {
  DEFAULT_PUBLIC_ITEM_KIND,
  MOVABLE_ITEM_KINDS,
  PROJECT_TASK_MESSAGES,
  PUBLIC_ITEM_KINDS,
  PUBLIC_PROJECT_ENDPOINT,
  PUBLIC_PROJECT_MESSAGES,
  PUBLIC_UPLOAD_PATHS,
  isMovableItemKind,
  type ProjectItemKind,
  type ProjectPriority,
} from "@/constants/clientProjectTasks"
import type { ProjectTask, ProjectTaskInput, PublicProject } from "@/types/clientProjectTasks"

/**
 * What a project's shared link opens, for a client who is not signed in to anything: the project,
 * who it is for, and its changes, ideas and discussion under the same three tabs the owner sees.
 *
 * **It writes.** The client adds items, edits them, ticks them off and removes them, with images,
 * files and a voice note, which is what the link is for: the work is theirs to describe. Every call
 * goes to this project's own token, so nothing here can reach another project, and the owner stops
 * all of it by turning the link off.
 *
 * **It shows the public tabs only** (`PUBLIC_ITEM_KINDS`): the project's credentials and its backups
 * are the owner's own and are never listed, never read and never writable from here. That is held
 * on the server as well as here, so the page's list of tabs is the convenience rather than the rule.
 *
 * There is still nothing here that says whose account the project is, or what else that client has.
 *
 * **It is full width**, like an employee's plan link and at the owner's request: no middle column
 * and no wide margins, just the page's side padding (16px, 24px from `sm`, 32px from `lg`), so a
 * long item stays on one line on a laptop instead of wrapping inside a 900px column.
 */
export default function PublicProjectClient({ token }: { token: string }) {
  const [project, setProject] = useState<PublicProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Only the tabs a link shows, so the one it opens on is the first of those
  const [tab, setTab] = useState<ProjectItemKind>(DEFAULT_PUBLIC_ITEM_KIND)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProjectTask | null>(null)
  const [movingTab, setMovingTab] = useState<ProjectTask | null>(null)
  const [deleting, setDeleting] = useState<ProjectTask | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const endpoint = `${PUBLIC_PROJECT_ENDPOINT}/${token}`

  useEffect(() => {
    const controller = new AbortController()
    requestApi<PublicProject>(endpoint, { signal: controller.signal })
      .then(({ data }) => setProject(data))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PUBLIC_PROJECT_MESSAGES.invalid)
      })
    return () => controller.abort()
  }, [endpoint])

  /** Changes the items on screen, leaving the rest of the project as it was. */
  const setTasks = (change: (current: ProjectTask[]) => ProjectTask[]) =>
    setProject((current) => (current ? { ...current, tasks: change(current.tasks) } : current))

  const addTask = async (input: ProjectTaskInput) => {
    // No retry: there is no account here, so the server cannot store an answer per idempotency key,
    // and a repeat would add the item twice. A dropped request is reported instead.
    const { data } = await requestApi<ProjectTask>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    setTasks((current) => [...current, data])
    setWriteError(null)
  }

  const saveTask = async (task: ProjectTask, input: Partial<ProjectTaskInput>) => {
    const { data } = await requestApi<ProjectTask>(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, ...input }),
    })
    setTasks((current) => current.map((row) => (row.id === task.id ? data : row)))
    return data
  }

  /** Ticking one off: the box moves at once and goes back if the write fails. */
  const tick = async (task: ProjectTask, done: boolean) => {
    const status = done ? "done" : "open"
    setBusyId(task.id)
    setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, status } : row)))
    try {
      await saveTask(task, { status })
      setWriteError(null)
    } catch (reason: unknown) {
      setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, status: task.status } : row)))
      setWriteError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  /** How urgent an item is, changed on the item itself, as the owner's page does. */
  const changePriority = async (task: ProjectTask, priority: ProjectPriority) => {
    setBusyId(task.id)
    setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, priority } : row)))
    try {
      await saveTask(task, { priority })
      setWriteError(null)
    } catch (reason: unknown) {
      setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, priority: task.priority } : row)))
      setWriteError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  /**
   * The order a drag left a tab in. It is the client's to set, like everything else on the public
   * tabs: the list moves at once, and a refusal puts it back and says the list moved on.
   */
  const reorder = async (orderedIds: string[]) => {
    const before = project?.tasks ?? []
    setTasks((current) => reorderItems(current, orderedIds))
    try {
      await requestApi(`${endpoint}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, orderedIds }),
      })
      setWriteError(null)
    } catch (reason: unknown) {
      setTasks(() => before)
      setWriteError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.reorderFailed)
    }
  }

  /** Moves one item to another tab, from the tabs this link shows. */
  const moveToTab = async (kind: ProjectItemKind) => {
    const task = movingTab
    if (!task) return
    await saveTask(task, { kind })
    setMovingTab(null)
  }

  const removeTask = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await requestApi(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: deleting.id }),
      })
      setTasks((current) => current.filter((row) => row.id !== deleting.id))
      setDeleting(null)
      setWriteError(null)
    } catch (reason: unknown) {
      setWriteError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.deleteFailed)
      setDeleting(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface">
      <header className="border-b border-outline-variant bg-white">
        <div className="flex w-full items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Image src={SITE_LOGO_PNG} alt="" width={24} height={24} className="rounded-md" />
          <span className="text-[13px] font-semibold text-on-surface">{SITE_NAME}</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
            <PencilLine size={12} aria-hidden="true" />
            {PUBLIC_PROJECT_MESSAGES.canWrite}
          </span>
        </div>
      </header>

      <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-white px-4 py-16 short:py-5 text-center">
            <FolderKanban size={22} className="text-outline" aria-hidden="true" />
            <p className="text-sm text-on-surface-variant">{error}</p>
          </div>
        ) : !project ? (
          <p role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            Loading the project...
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-outline-variant bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-xl font-bold text-on-surface">{project.name}</h1>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    project.status === "completed" ? "bg-success-container text-on-success-container" : "bg-secondary-fixed text-on-secondary-fixed-variant"
                  }`}
                >
                  {project.status === "completed" ? "Completed" : "Active"}
                </span>
              </div>
              {project.clientName && <p className="mt-1 text-[13px] text-on-surface-variant">For {project.clientName}</p>}
              {project.description && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-on-surface-variant">{project.description}</p>}
              <p className="mt-3 rounded-xl bg-surface-container-lowest px-3 py-2 text-[12px] text-on-surface-variant">{PUBLIC_PROJECT_MESSAGES.intro}</p>
            </section>

            <ProjectTabs chosen={tab} onChoose={setTab} counts={countsOf(project.tasks)} kinds={PUBLIC_ITEM_KINDS} />

            <section id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`} className="flex min-w-0 flex-col gap-3">
              <TaskComposer
                key={tab}
                task={null}
                kind={tab}
                onSave={addTask}
                imageEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.images}`}
                voiceEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.voice}`}
                fileEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.files}`}
              />

              {writeError && (
                <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                  {writeError}
                </p>
              )}

              <ProjectTasks
                tasks={project.tasks.filter((task) => task.kind === tab)}
                kind={tab}
                projectName={project.name}
                busyId={busyId}
                onTick={tick}
                onEdit={setEditing}
                onDelete={setDeleting}
                onMoveTab={isMovableItemKind(tab) ? setMovingTab : undefined}
                onPriority={changePriority}
                onReorder={reorder}
                detailsOpen
              />
            </section>
          </>
        )}
      </main>

      {editing && (
        <Modal title="Edit" onClose={() => setEditing(null)} size="large">
          <TaskComposer
            task={editing}
            kind={editing.kind}
            onCancel={() => setEditing(null)}
            imageEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.images}`}
            voiceEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.voice}`}
            fileEndpoint={`${endpoint}/${PUBLIC_UPLOAD_PATHS.files}`}
            onSave={async (input) => {
              await saveTask(editing, input)
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {movingTab && (
        <MoveToTabDialog
          task={movingTab}
          onMove={moveToTab}
          onClose={() => setMovingTab(null)}
          // Only the tabs this link shows, so a client is never offered one they cannot open
          kinds={MOVABLE_ITEM_KINDS.filter((kind) => kind.isPublic)}
        />
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
