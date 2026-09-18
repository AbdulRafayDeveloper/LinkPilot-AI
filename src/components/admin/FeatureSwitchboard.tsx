"use client"

import React from "react"
import { Check, Loader2 } from "lucide-react"
import { TOOL_GROUPS } from "@/constants/linkedinTools"
import { manageableFeatures } from "@/constants/featureAccess"

interface FeatureSwitchboardProps {
  // Whether a tool is off, in whatever sense the page means: for everyone, or for one account
  isOff: (toolId: string) => boolean
  // A small tag beside a tool, such as "Own choice" on one account's page
  noteFor?: (toolId: string) => React.ReactNode
  // Tools whose change is still being saved
  busy: ReadonlySet<string>
  disabled?: boolean
  // Some tools set on or off: one tool, or a whole sidebar group at once
  onChange: (toolIds: string[], on: boolean) => void
}

const Track: React.FC<{ on: boolean; mixed?: boolean }> = ({ on, mixed = false }) => (
  <span
    aria-hidden="true"
    className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${on ? "bg-primary" : mixed ? "bg-primary/40" : "bg-outline-variant"}`}
  >
    <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${on ? "translate-x-4" : mixed ? "translate-x-2" : ""}`}>
      {on && <Check size={10} className="text-primary" />}
    </span>
  </span>
)

/**
 * The tools an admin can turn on and off, under the sidebar's own headings, with a switch for each
 * tool and one for each heading. A heading's switch turns every tool under it off when they are all
 * on, and all of them on otherwise, so a half-on group is one click from fully on. It is the same
 * board for every user and for one account, so the two can never lay the tools out differently.
 */
export const FeatureSwitchboard: React.FC<FeatureSwitchboardProps> = ({ isOff, noteFor, busy, disabled = false, onChange }) => {
  const tools = manageableFeatures()

  return (
    <div className="flex flex-col gap-4">
      {TOOL_GROUPS.map((group) => {
        const inGroup = tools.filter((tool) => tool.group === group.id)
        if (inGroup.length === 0) return null
        const onCount = inGroup.filter((tool) => !isOff(tool.id)).length
        const allOn = onCount === inGroup.length
        const isBusy = inGroup.some((tool) => busy.has(tool.id))
        return (
          <section key={group.id} aria-label={group.label}>
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-outline-variant/70 pb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{group.label}</h4>
              <button
                type="button"
                role="switch"
                aria-checked={allOn}
                onClick={() => onChange(inGroup.map((tool) => tool.id), !allOn)}
                disabled={disabled || isBusy}
                aria-label={`${group.label}: ${onCount} of ${inGroup.length} on. Turn all ${allOn ? "off" : "on"}`}
                title={`Turn every tool under ${group.label} ${allOn ? "off" : "on"}`}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                <span className="text-outline">
                  {allOn ? "All on" : onCount === 0 ? "All off" : `${onCount} of ${inGroup.length} on`}
                </span>
                <Track on={allOn} mixed={!allOn && onCount > 0} />
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {inGroup.map((tool) => {
                const off = isOff(tool.id)
                const saving = busy.has(tool.id)
                return (
                  <li key={tool.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      onClick={() => onChange([tool.id], off)}
                      disabled={disabled || saving}
                      title={tool.description}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:opacity-60 ${
                        off ? "border-outline-variant bg-white text-outline" : "border-primary/30 bg-primary-fixed/25 text-on-surface"
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-[13px] font-semibold">{tool.title}</span>
                        {noteFor?.(tool.id)}
                      </span>
                      {saving ? <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" /> : <Track on={!off} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
