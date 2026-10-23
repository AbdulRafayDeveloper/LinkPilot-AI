"use client"

import React from "react"
import { CheckCircle2, Circle, Copy, FileText, FolderInput, GitBranch, Lock, Pencil, Trash2 } from "lucide-react"
import { ActionMenu, type ActionMenuGroup, type ActionMenuItem } from "@/components/ui/ActionMenu"
import { PROMPT_DEPENDENCY_MESSAGES, describePending } from "@/constants/promptDependencies"
import { pendingDependencies } from "@/lib/promptDependencies"
import type { SavedOutputTool } from "@/constants/savedOutputs"
import type { SavedOutput } from "@/types/savedOutputs"

interface RecordRowMenuProps {
  // What the tool offers decides what the menu holds: Edit, Mark applied, Dependencies, Move
  tool: SavedOutputTool
  item: SavedOutput
  // The record's own write is still running, so the button is a spinner and nothing can be chosen
  isBusy: boolean
  onView: (item: SavedOutput) => void
  onEdit: (item: SavedOutput) => void
  onMarkApplied: (item: SavedOutput) => void
  onWaitsFor: (item: SavedOutput) => void
  onMove: (item: SavedOutput) => void
  // What to copy and how to get it: a written text is in hand, the source is read from the server
  onCopy: (what: string, load: () => Promise<string>) => void
  loadSource: (id: string) => Promise<string>
  onDelete: (item: SavedOutput) => void
}

/**
 * Everything a row can do, behind one three-dot button, the way a daily task's row works, at the
 * owner's request. A row carried up to seven buttons ("View details", "Delete", "Mark applied",
 * "Dependencies", "Move", "Copy prompt", "Copy description"), which read as a wall of small words
 * and spent a quarter of the table on itself; each one is now a line of the menu with its word and
 * its icon, in three groups: what to do with the record, what to copy, and Delete on its own in the
 * error colour so it is never chosen by mistake for the line above it.
 *
 * **What each line does is exactly what its button did.** Marking a record applied is still refused
 * while it waits for records that have not run, with the same message naming them as its tooltip,
 * and Delete still deletes on one click with nothing to confirm, the row leaving the list at once.
 *
 * It is a component rather than a function the page calls while it renders, because its lines close
 * over what reads the record's source (a ref holding one request per record) and over the clock:
 * built during a render, that is work the React Compiler rightly refuses.
 */
export const RecordRowMenu: React.FC<RecordRowMenuProps> = ({
  tool,
  item,
  isBusy,
  onView,
  onEdit,
  onMarkApplied,
  onWaitsFor,
  onMove,
  onCopy,
  loadSource,
  onDelete,
}) => {
  const record: ActionMenuItem[] = [
    {
      id: "view",
      label: "View details",
      icon: <FileText size={14} />,
      onSelect: () => onView(item),
      hint: item.sourceLabel ? `Everything written, and the ${item.sourceLabel.toLowerCase()} it was written from` : "Everything written, in full",
    },
  ]

  if (tool.editable) {
    record.push({
      id: "edit",
      label: tool.editable.label,
      icon: <Pencil size={14} />,
      onSelect: () => onEdit(item),
      hint: `Change the name, or the ${tool.noun.one} itself`,
    })
  }

  if (tool.canMarkApplied) {
    // A record is run by applying it, so one still waiting cannot be marked. Taking the mark off
    // always stays possible: it says what happened, not what may happen next
    const pending = pendingDependencies(item.dependencies ?? [])
    const isBlocked = !item.appliedAt && pending.length > 0
    record.push({
      id: "applied",
      label: item.appliedAt ? "Take the applied mark off" : "Mark applied",
      icon: item.appliedAt ? <CheckCircle2 size={14} /> : isBlocked ? <Lock size={14} /> : <Circle size={14} />,
      onSelect: () => onMarkApplied(item),
      disabled: isBlocked,
      hint: isBlocked
        ? describePending(pending.map((entry) => entry.name || "Untitled prompt"))
        : item.appliedAt
          ? "Mark it as one you have not used after all"
          : "You have used this one",
    })
  }

  if (tool.dependencies) {
    const waits = item.dependencies?.length ?? 0
    record.push({
      id: "waits",
      label: waits > 0 ? `${PROMPT_DEPENDENCY_MESSAGES.dependsOn} ${waits}` : PROMPT_DEPENDENCY_MESSAGES.edit,
      icon: <GitBranch size={14} />,
      onSelect: () => onWaitsFor(item),
      hint: PROMPT_DEPENDENCY_MESSAGES.dialogHint,
    })
  }

  if (tool.folders) {
    record.push({
      id: "folder",
      label: item.folder ? "Move to another folder" : "Add to a folder",
      icon: <FolderInput size={14} />,
      onSelect: () => onMove(item),
      hint: item.folder ? `Filed in ${item.folder.name}` : undefined,
    })
  }

  const copies: ActionMenuItem[] = item.texts.map((part) => ({
    id: `copy-${part.label}`,
    label: `Copy ${part.label.toLowerCase()}`,
    icon: <Copy size={14} />,
    onSelect: () => onCopy(part.label, async () => part.text),
  }))

  // What a record was written from is never in the list, so the clipboard is handed the request
  const sourceLabel = item.sourceLabel
  if (sourceLabel) {
    copies.push({
      id: "copy-source",
      label: `Copy ${sourceLabel.toLowerCase()}`,
      icon: <Copy size={14} />,
      onSelect: () => onCopy(sourceLabel, () => loadSource(item.id)),
      hint: `The ${sourceLabel.toLowerCase()} it was written from, which the list leaves out`,
    })
  }

  const groups: ActionMenuGroup[] = [
    { id: "record", items: record },
    { id: "copy", heading: "Copy", items: copies },
    {
      id: "delete",
      items: [
        {
          id: "delete",
          label: `Delete ${tool.noun.one}`,
          icon: <Trash2 size={14} />,
          onSelect: () => onDelete(item),
          tone: "danger",
          hint: "Deleted at once, with nothing to confirm",
        },
      ],
    },
  ]

  return <ActionMenu label={item.title} groups={groups} isBusy={isBusy} />
}
