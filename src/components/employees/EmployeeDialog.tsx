"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { todayIso } from "@/lib/taskDates"
import {
  EMPLOYEES_ENDPOINT,
  EMPLOYEE_CITY_MAX_LENGTH,
  EMPLOYEE_MESSAGES,
  EMPLOYEE_NAME_MAX_LENGTH,
  EMPLOYEE_ROLE_MAX_LENGTH,
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from "@/constants/employees"
import type { Employee, EmployeeInput } from "@/types/employees"

const fieldClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

interface EmployeeDialogProps {
  // The employee being edited, or null to add a new one
  employee: Employee | null
  onClose: () => void
  onSaved: (employee: Employee) => void
}

/**
 * Add and Edit share one dialog, so editing starts from what was saved. The server checks every
 * field again; its message is shown as is when it refuses one.
 */
export const EmployeeDialog: React.FC<EmployeeDialogProps> = ({ employee, onClose, onSaved }) => {
  const [form, setForm] = useState<EmployeeInput>(
    employee
      ? { name: employee.name, city: employee.city, role: employee.role, joiningDate: employee.joiningDate, status: employee.status }
      : { name: "", city: "", role: "", joiningDate: todayIso(), status: "active" }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const update = <K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<Employee>(employee ? `${EMPLOYEES_ENDPOINT}/${employee.id}` : EMPLOYEES_ENDPOINT, {
        method: employee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }, { idempotent: true })
      onSaved(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={employee ? `Edit ${employee.name}` : "Add an employee"}
      description={employee ? "Change their details. Their plans stay as they are." : "Their details now, their plans afterwards."}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      size="compact"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {employee ? "Save changes" : "Add employee"}
          </button>
        </div>
      }
    >
      <form id="employee-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input ref={nameRef} value={form.name} maxLength={EMPLOYEE_NAME_MAX_LENGTH} onChange={(event) => update("name", event.target.value)} className={fieldClass} placeholder="Full name" required />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Role</span>
            <input value={form.role} maxLength={EMPLOYEE_ROLE_MAX_LENGTH} onChange={(event) => update("role", event.target.value)} className={fieldClass} placeholder="e.g. Frontend Developer" required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>City</span>
            <input value={form.city} maxLength={EMPLOYEE_CITY_MAX_LENGTH} onChange={(event) => update("city", event.target.value)} className={fieldClass} placeholder="e.g. Lahore" required />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Date of joining</span>
          <input type="date" value={form.joiningDate} onChange={(event) => update("joiningDate", event.target.value)} className={fieldClass} required />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>Employment status</legend>
          <div className="grid grid-cols-2 gap-2">
            {EMPLOYEE_STATUSES.map((status) => {
              const isChosen = form.status === status.id
              return (
                <label
                  key={status.id}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                    isChosen
                      ? status.id === "active"
                        ? "border-success bg-success-container text-on-success-container"
                        : "border-outline bg-surface-container-high text-on-surface"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={status.id}
                    checked={isChosen}
                    onChange={() => update("status", status.id as EmployeeStatus)}
                    className="sr-only"
                  />
                  {status.label}
                </label>
              )
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
