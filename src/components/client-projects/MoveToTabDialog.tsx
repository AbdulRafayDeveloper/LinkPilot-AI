"use client"

import React, { useState } from "react"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { MOVABLE_ITEM_KINDS, PROJECT_TASK_MESSAGES, projectItemKind, type ProjectItemKind } from "@/constants/clientProjectTasks"
import type { ProjectTask } from "@/types/clientProjectTasks"

interface MoveToTabDialogProps {
  task: ProjectTask
  onMove: (kind: ProjectItemKind) => Promise<void>
  onClose: () => void
  /**
   * The tabs to offer. Left out it is every tab an item may move between; a shared link passes the
   * public ones, so a client is never offered a tab their link does not show.
   */
  kinds?: readonly (typeof MOVABLE_ITEM_KINDS)[number][]
}

/**
 * Moving one item to another tab: a change becomes an idea, an idea joins the backlog, something
 * from the discussion becomes a marketing idea. It keeps everything it carries (its description,
 * its images, its files, its voice note) and takes the new tab's own next number, so the tab it
 * joins reads as if it had been written there.
 *
 * Only the tabs people write on are offered, because every other tab needs something they have not
 * got: a credential is the text under it, a link is an address, a document and a backup are a file.
 * The same dialog serves the owner's page and the shared link.
 */
export const MoveToTabDialog: React.FC<MoveToTabDialogProps> = ({ task, onMove, onClose, kinds = MOVABLE_ITEM_KINDS }) => {
  const [busy, setBusy] = useState<ProjectItemKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  const move = async (kind: ProjectItemKind) => {
    if (kind === task.kind) return
    setBusy(kind)
    setError(null)
    try {
      await onMove(kind)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.moveItemFailed)
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} title={PROJECT_TASK_MESSAGES.moveToTab} size="compact">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-on-surface-variant">
          <span className="font-semibold text-on-surface">{task.content}</span> is on {projectItemKind(task.kind).label}.{" "}
          {PROJECT_TASK_MESSAGES.moveToTabExplains}
        </p>
        <ul className="flex flex-col gap-1.5">
          {kinds.map((kind) => {
            const isHere = kind.id === task.kind
            return (
              <li key={kind.id}>
                <button
                  type="button"
                  onClick={() => move(kind.id)}
                  disabled={isHere || busy !== null}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${
                    isHere
                      ? "border-outline-variant bg-surface-container-low text-outline"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/50 hover:bg-primary-fixed/30"
                  }`}
                >
                  <span className="min-w-0 truncate">{kind.label}</span>
                  {busy === kind.id ? (
                    <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
                  ) : isHere ? (
                    <span className="shrink-0 text-[11px] font-normal">{PROJECT_TASK_MESSAGES.moveToTabSame}</span>
                  ) : (
                    <ArrowLeftRight size={14} className="shrink-0 text-outline" aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {error && (
          <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
