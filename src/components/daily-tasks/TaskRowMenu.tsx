"use client"

import React from "react"
import { CalendarArrowUp, Check, Copy, Eye, ListPlus, Lock, LockOpen, Paperclip, Repeat, Trash2 } from "lucide-react"
import { ActionMenu, type ActionMenuGroup } from "@/components/ui/ActionMenu"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { DAILY_TASKS_MESSAGES } from "@/constants/dailyTasks"
import { TASK_ATTACHMENT_MESSAGES, TASK_MAX_DEPTH } from "@/constants/taskAttachments"
import type { TaskChoices } from "@/lib/taskChoices"
import { NO_REPEAT, TASK_REPEATS } from "@/lib/taskRepeat"
import type { DailyTask } from "@/types/dailyTasks"

interface TaskRowMenuProps {
  task: DailyTask
  // 1 for a task, 2 for a subtask, 3 for a sub-subtask, which has nothing under it
  depth: number
  isPending: boolean
  // Only a task of an earlier day that still has open work, so the menu offers to bring it to today
  isOverdue?: boolean
  onOpenTask?: (task: DailyTask, focusSubtask?: boolean) => void
  onMoveToToday?: (task: DailyTask) => void
  onChoose?: (task: DailyTask, change: Partial<TaskChoices>) => void
  onDelete?: (task: DailyTask) => void
}

/**
 * Everything that can be done to a task from its row, behind one three-dot button, at the owner's
 * request: the six icons that sat on every row (block, repeat, details, add subtask, copy, delete)
 * could not be read, so each is now a line of the menu with its word beside its icon. **What each
 * one does is exactly what the icon did**: blocking and the interval are still their own one-field
 * writes through `onChoose`, the details and a subtask still open the task's popup, Copy still puts
 * the task's own line on the clipboard, and Delete still deletes on one click.
 *
 * It is the same menu on a task, a subtask and a sub-subtask; only Add subtask changes its word and
 * is refused at the third level, with why as its tooltip. Without handlers (the copy of a row that
 * follows the pointer during a drag) it is the button alone, so nothing shifts.
 */
export const TaskRowMenu: React.FC<TaskRowMenuProps> = ({ task, depth, isPending, isOverdue = false, onOpenTask, onMoveToToday, onChoose, onDelete }) => {
  const { copied, copy } = useCopyToClipboard()
  if (!onOpenTask || !onDelete) return <ActionMenu label={task.content} groups={[]} isPlaceholder />

  const hasDetails = Boolean(task.description || task.images.length > 0)
  const canNest = depth < TASK_MAX_DEPTH
  const addLabel = depth === 1 ? TASK_ATTACHMENT_MESSAGES.addSubtask : TASK_ATTACHMENT_MESSAGES.addSubSubtask

  const groups: ActionMenuGroup[] = [
    {
      id: "task",
      items: [
        { id: "view", label: DAILY_TASKS_MESSAGES.viewTask, icon: <Eye size={14} />, onSelect: () => onOpenTask(task), hint: DAILY_TASKS_MESSAGES.viewTaskHint },
        { id: "details", label: hasDetails ? "Edit details" : "Add details", icon: <Paperclip size={14} />, onSelect: () => onOpenTask(task), hint: hasDetails ? "Open the details and subtasks" : "Add a description, images or subtasks" },
        { id: "subtask", label: addLabel, icon: <ListPlus size={14} />, onSelect: () => onOpenTask(task, true), disabled: !canNest, hint: canNest ? undefined : TASK_ATTACHMENT_MESSAGES.depthReached },
        { id: "copy", label: copied ? "Copied" : TASK_ATTACHMENT_MESSAGES.copyText, icon: copied ? <Check size={14} /> : <Copy size={14} />, onSelect: () => void copy(task.content) },
        ...(isOverdue && onMoveToToday
          ? [{ id: "move", label: DAILY_TASKS_MESSAGES.moveThisOverdue, icon: <CalendarArrowUp size={14} />, onSelect: () => onMoveToToday(task) }]
          : []),
      ],
    },
    {
      id: "blocked",
      items: [
        {
          id: "block",
          label: task.isBlocked ? DAILY_TASKS_MESSAGES.unblockTask : DAILY_TASKS_MESSAGES.blockTask,
          icon: task.isBlocked ? <LockOpen size={14} /> : <Lock size={14} />,
          onSelect: () => onChoose?.(task, { isBlocked: !task.isBlocked }),
          disabled: !onChoose,
          hint: task.isBlocked ? DAILY_TASKS_MESSAGES.unblock : DAILY_TASKS_MESSAGES.block,
        },
      ],
    },
    {
      id: "repeat",
      heading: DAILY_TASKS_MESSAGES.repeatHeading,
      items: [
        { id: "once", label: DAILY_TASKS_MESSAGES.once, icon: <Repeat size={14} />, onSelect: () => onChoose?.(task, { repeat: NO_REPEAT }), disabled: !onChoose, checked: task.repeat === NO_REPEAT, hint: DAILY_TASKS_MESSAGES.stopRepeating },
        ...TASK_REPEATS.map((kind) => ({
          id: kind.id,
          label: kind.label,
          icon: <Repeat size={14} />,
          onSelect: () => onChoose?.(task, { repeat: kind.id }),
          disabled: !onChoose,
          checked: task.repeat === kind.id,
          hint: DAILY_TASKS_MESSAGES.repeatsEvery(kind.due),
        })),
      ],
    },
    {
      id: "delete",
      items: [{ id: "delete", label: DAILY_TASKS_MESSAGES.deleteTask, icon: <Trash2 size={14} />, onSelect: () => onDelete(task), tone: "danger" }],
    },
  ]

  return <ActionMenu label={task.content} groups={groups} isBusy={isPending} />
}
