"use client"

import React from "react"
import { Modal } from "@/components/ui/Modal"
import { TaskComposer, type TaskRow } from "./TaskComposer"

interface AddTasksDialogProps {
  today: string
  taskDate: string
  rows: TaskRow[]
  isSaving: boolean
  error: string | null
  notice: string | null
  onDateChange: (date: string) => void
  onRowsChange: (rows: TaskRow[]) => void
  onSubmit: () => void
  onClose: () => void
}

/**
 * The composer in a popup, opened by Add task in the page header, so the list of days has the page
 * to itself. It is the same `TaskComposer` with the same props, without its own card and heading
 * (the dialog carries those); what is typed lives in the page's draft store, so closing the popup
 * keeps it for the next time it is opened.
 */
export const AddTasksDialog: React.FC<AddTasksDialogProps> = ({ onClose, isSaving, ...composer }) => (
  <Modal
    title="Add tasks"
    description="Write the day's tasks in one go. Enter opens the next row, and one save writes them all."
    onClose={onClose}
    isCloseDisabled={isSaving}
    size="large"
  >
    <TaskComposer {...composer} isSaving={isSaving} plain />
  </Modal>
)
