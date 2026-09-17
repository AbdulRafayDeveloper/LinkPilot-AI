"use client"

import React, { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { SortableList } from "@/components/ui/SortableList"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { newStage, newStep } from "@/lib/meetingScript"
import {
  SCRIPT_FEATURE_MAX_LENGTH,
  SCRIPT_MAX_FEATURES,
  SCRIPT_MAX_MINUTES,
  SCRIPT_MAX_STAGES,
  SCRIPT_MAX_STEPS_PER_STAGE,
  SCRIPT_STEP_KINDS,
  SCRIPT_TEXT_MAX_LENGTH,
  SCRIPT_TITLE_MAX_LENGTH,
  type ScriptStepKindId,
} from "@/constants/meetingPlanner"
import type { ScriptStage, ScriptStep } from "@/types/meetingPlanner"
import { STEP_STYLE } from "./ConversationScript"

interface ConversationDraft {
  // The meeting being edited; null when nothing is
  meetingId: string | null
  stages: ScriptStage[]
  isDirty: boolean
}

/**
 * The conversation being edited, kept outside the page like every tool's inputs, so going to
 * another page and coming back, or a refresh, never loses an unsaved edit.
 */
export const conversationDraftStore = createToolStore<ConversationDraft>(
  "meeting-planner:conversation-draft",
  { meetingId: null, stages: [], isDirty: false },
  { version: 1 }
)

export function startConversationEdit(meetingId: string, stages: ScriptStage[]) {
  conversationDraftStore.update({ meetingId, stages, isDirty: false })
}

export function endConversationEdit() {
  conversationDraftStore.reset()
}

export const useConversationDraft = () => useToolStore(conversationDraftStore)

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-2.5 py-2 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"

// What goes into a saved script: a feature list without the blank lines typing leaves behind
const cleaned = (stages: ScriptStage[]): ScriptStage[] =>
  stages.map((stage) => ({
    ...stage,
    title: stage.title.trim(),
    steps: stage.steps.map((step) => ({
      ...step,
      features: step.kind === "show_project" ? step.features.map((feature) => feature.trim()).filter(Boolean) : [],
      project: step.kind === "show_project" ? step.project : "",
      minutes: step.kind === "show_project" ? step.minutes : 0,
    })),
  }))

interface StepEditorProps {
  step: ScriptStep
  handle: React.ReactNode
  projects: string[]
  onChange: (patch: Partial<ScriptStep>) => void
  onDelete: () => void
}

const StepEditor: React.FC<StepEditorProps> = ({ step, handle, projects, onChange, onDelete }) => {
  const style = STEP_STYLE[step.kind]
  const Icon = style.icon
  const listId = `projects-${step.id}`
  return (
    <div className={`flex gap-2 rounded-xl border p-2 ${style.box}`}>
      <div className="flex flex-col items-center gap-1 pt-0.5">
        {handle}
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${style.badge}`} aria-hidden="true">
          <Icon size={13} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <select
            value={step.kind}
            onChange={(event) => onChange({ kind: event.target.value as ScriptStepKindId })}
            aria-label="Kind of step"
            className="rounded-lg border border-outline-variant bg-white px-2 py-1 text-[12px] font-bold uppercase tracking-wide text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {SCRIPT_STEP_KINDS.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete this ${style.label.toLowerCase()} step`}
            title="Delete step"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error/10 hover:text-error"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>

        {step.kind === "show_project" && (
          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Project
              <input
                value={step.project}
                onChange={(event) => onChange({ project: event.target.value })}
                list={listId}
                maxLength={SCRIPT_TITLE_MAX_LENGTH}
                placeholder="Which project to open"
                className={`${inputClass} normal-case tracking-normal`}
              />
              <datalist id={listId}>
                {projects.map((project) => (
                  <option key={project} value={project} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Minutes
              <input
                type="number"
                min={1}
                max={SCRIPT_MAX_MINUTES}
                value={step.minutes || ""}
                onChange={(event) => {
                  const minutes = Math.round(Number(event.target.value))
                  onChange({ minutes: Number.isFinite(minutes) ? Math.min(SCRIPT_MAX_MINUTES, Math.max(0, minutes)) : 0 })
                }}
                className={`${inputClass} tabular-nums`}
              />
            </label>
          </div>
        )}

        <RichTextEditor
          id={`step-${step.id}`}
          value={step.text}
          onChange={(text) => onChange({ text })}
          maxLength={SCRIPT_TEXT_MAX_LENGTH}
          rows={step.kind === "say" || step.kind === "show_project" ? 3 : 2}
          placeholder={SCRIPT_STEP_KINDS.find((kind) => kind.id === step.kind)?.hint}
          ariaLabel={`${style.label} text`}
          compact
        />

        {step.kind === "show_project" && (
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Features to show, one per line
            <textarea
              value={step.features.join("\n")}
              onChange={(event) =>
                onChange({
                  features: event.target.value
                    .split("\n")
                    .slice(0, SCRIPT_MAX_FEATURES)
                    .map((feature) => feature.slice(0, SCRIPT_FEATURE_MAX_LENGTH)),
                })
              }
              rows={3}
              className={`${inputClass} resize-y normal-case tracking-normal`}
            />
          </label>
        )}
      </div>
    </div>
  )
}

interface ConversationEditorProps {
  projects: string[]
  isSaving: boolean
  error: string | null
  onSave: (stages: ScriptStage[]) => void
  onCancel: () => void
}

/**
 * Edits the conversation script in place: stages and the steps inside them are dragged into order
 * (or moved with the arrow keys on their handle) and renumber themselves, every text takes bold,
 * italic, lists and links, and stages and steps are added and removed. Nothing is saved until Save.
 */
export const ConversationEditor: React.FC<ConversationEditorProps> = ({ projects, isSaving, error, onSave, onCancel }) => {
  const draft = useConversationDraft()
  const stages = draft.stages
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const setStages = (next: ScriptStage[]) => conversationDraftStore.update({ stages: next, isDirty: true })
  const updateStage = (id: string, patch: Partial<ScriptStage>) =>
    setStages(stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)))
  const updateStep = (stageId: string, stepId: string, patch: Partial<ScriptStep>) =>
    setStages(
      stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, steps: stage.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)) }
          : stage
      )
    )

  const addStage = (afterIndex: number) => {
    if (stages.length >= SCRIPT_MAX_STAGES) return
    const stage = newStage("New stage")
    setStages([...stages.slice(0, afterIndex + 1), stage, ...stages.slice(afterIndex + 1)])
    window.requestAnimationFrame(() => document.getElementById(`stage-title-${stage.id}`)?.focus())
  }

  const addStep = (stage: ScriptStage, kind: ScriptStepKindId) => {
    if (stage.steps.length >= SCRIPT_MAX_STEPS_PER_STAGE) return
    const step = newStep(kind)
    updateStage(stage.id, { steps: [...stage.steps, step] })
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(stage.id)
      return next
    })
    window.requestAnimationFrame(() => document.getElementById(`step-${step.id}`)?.focus())
  }

  const save = () => {
    if (!isSaving) onSave(cleaned(stages))
  }

  // Ctrl/⌘+S saves while editing, and leaving the page with unsaved changes asks first
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault()
        document.getElementById("conversation-save")?.click()
      }
    }
    const onLeave = (event: BeforeUnloadEvent) => {
      if (conversationDraftStore.getSnapshot().isDirty) event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("beforeunload", onLeave)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("beforeunload", onLeave)
    }
  }, [])

  const allCollapsed = stages.length > 0 && stages.every((stage) => collapsed.has(stage.id))
  const missingTitle = stages.some((stage) => !stage.title.trim())

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-white/95 px-5 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(stages.map((stage) => stage.id)))}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          {allCollapsed ? <ChevronsUpDown size={14} aria-hidden="true" /> : <ChevronsDownUp size={14} aria-hidden="true" />}
          {allCollapsed ? "Expand all" : "Collapse all to reorder"}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {confirmingDiscard ? (
            <>
              <span className="text-[12px] text-on-surface-variant">Discard your changes?</span>
              <button
                type="button"
                onClick={onCancel}
                className="whitespace-nowrap rounded-lg bg-error px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-error/90"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface hover:bg-surface-container-high"
              >
                Keep editing
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => (draft.isDirty ? setConfirmingDiscard(true) : onCancel())}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" />
              Cancel
            </button>
          )}
          <button
            id="conversation-save"
            type="button"
            onClick={save}
            disabled={isSaving || missingTitle}
            title={missingTitle ? "Every stage needs a title" : "Save (Ctrl+S)"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            {isSaving ? "Saving..." : "Save conversation"}
          </button>
        </div>
      </div>

      {(error || missingTitle) && (
        <p role="alert" className="text-[12px] text-error">
          {error ?? "Every stage needs a title before it can be saved."}
        </p>
      )}

      <SortableList
        items={stages}
        getId={(stage) => stage.id}
        getLabel={(stage) => stage.title || "Untitled stage"}
        onReorder={(ids) => setStages(ids.map((id) => stages.find((stage) => stage.id === id)).filter((stage): stage is ScriptStage => Boolean(stage)))}
        label="Conversation stages"
        className="flex flex-col gap-3"
        renderItem={(stage, handle) => {
          const index = stages.findIndex((entry) => entry.id === stage.id)
          const isCollapsed = collapsed.has(stage.id)
          return (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
              <div className="flex items-center gap-2">
                {handle}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-on-surface text-[13px] font-bold text-white tabular-nums">
                  {index + 1}
                </span>
                <input
                  id={`stage-title-${stage.id}`}
                  value={stage.title}
                  onChange={(event) => updateStage(stage.id, { title: event.target.value })}
                  maxLength={SCRIPT_TITLE_MAX_LENGTH}
                  placeholder="Stage title"
                  aria-label={`Title of stage ${index + 1}`}
                  className={`${inputClass} min-w-0 flex-1 font-bold`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(stage.id)) next.delete(stage.id)
                      else next.add(stage.id)
                      return next
                    })
                  }
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? "Show this stage's steps" : "Hide this stage's steps"}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
                >
                  {isCollapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                </button>
                {confirmingDelete === stage.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStages(stages.filter((entry) => entry.id !== stage.id))
                      setConfirmingDelete(null)
                    }}
                    onBlur={() => setConfirmingDelete(null)}
                    className="whitespace-nowrap rounded-lg bg-error px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-error/90"
                  >
                    Delete stage
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(stage.id)}
                    aria-label={`Delete stage ${index + 1}`}
                    title="Delete stage"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {isCollapsed ? (
                <p className="mt-1 pl-[76px] text-[12px] text-outline">
                  {stage.steps.length} {stage.steps.length === 1 ? "step" : "steps"}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3 sm:pl-9">
                  <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Goal of this stage
                    <input
                      value={stage.goal}
                      onChange={(event) => updateStage(stage.id, { goal: event.target.value })}
                      maxLength={SCRIPT_TEXT_MAX_LENGTH}
                      className={`${inputClass} font-normal normal-case tracking-normal`}
                    />
                  </label>

                  <SortableList
                    items={stage.steps}
                    getId={(step) => step.id}
                    getLabel={(step) => `${STEP_STYLE[step.kind].label} step`}
                    onReorder={(ids) =>
                      updateStage(stage.id, {
                        steps: ids.map((id) => stage.steps.find((step) => step.id === id)).filter((step): step is ScriptStep => Boolean(step)),
                      })
                    }
                    label={`Steps of stage ${index + 1}`}
                    className="flex flex-col gap-2"
                    renderItem={(step, stepHandle) => (
                      <StepEditor
                        step={step}
                        handle={stepHandle}
                        projects={projects}
                        onChange={(patch) => updateStep(stage.id, step.id, patch)}
                        onDelete={() => updateStage(stage.id, { steps: stage.steps.filter((entry) => entry.id !== step.id) })}
                      />
                    )}
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-outline">Add step</span>
                    {SCRIPT_STEP_KINDS.map((kind) => {
                      const Icon = STEP_STYLE[kind.id].icon
                      return (
                        <button
                          key={kind.id}
                          type="button"
                          onClick={() => addStep(stage, kind.id)}
                          disabled={stage.steps.length >= SCRIPT_MAX_STEPS_PER_STAGE}
                          title={kind.hint}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-outline-variant bg-white px-2.5 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          <Icon size={13} aria-hidden="true" />
                          {kind.label}
                        </button>
                      )
                    })}
                  </div>

                  <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Move on when
                    <input
                      value={stage.move_on_when}
                      onChange={(event) => updateStage(stage.id, { move_on_when: event.target.value })}
                      maxLength={SCRIPT_TEXT_MAX_LENGTH}
                      className={`${inputClass} font-normal normal-case tracking-normal`}
                    />
                  </label>
                </div>
              )}

              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => addStage(index)}
                  disabled={stages.length >= SCRIPT_MAX_STAGES}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-50"
                >
                  <Plus size={13} aria-hidden="true" />
                  Add a stage below
                </button>
              </div>
            </div>
          )
        }}
      />

      {stages.length === 0 && (
        <button
          type="button"
          onClick={() => addStage(-1)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-outline-variant px-4 py-3 text-[13px] font-semibold text-on-surface-variant hover:border-primary hover:text-primary"
        >
          <Plus size={15} aria-hidden="true" />
          Add the first stage
        </button>
      )}
    </div>
  )
}
