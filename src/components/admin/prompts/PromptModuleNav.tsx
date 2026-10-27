"use client"

import React, { useState } from "react"
import { Search, X } from "lucide-react"
import { ADMIN_PROMPT_MESSAGES } from "@/constants/adminPrompts"
import { narrowSections, type PromptModuleEntry, type PromptModuleSection } from "@/lib/promptModules"

/**
 * The list the prompts page is read by: a heading, a search, then each area of the sidebar in its own
 * order with the modules that have prompts, the global and shared prompts first. From `lg` it stands
 * beside the prompts and scrolls on its own; below that it is one dropdown above them, since a phone
 * has no width for a second column.
 */

interface PromptModuleNavProps {
  sections: PromptModuleSection[]
  chosen: PromptModuleEntry
  onChoose: (id: string) => void
}

export const PromptModuleNav: React.FC<PromptModuleNavProps> = ({ sections, chosen, onChoose }) => {
  const [search, setSearch] = useState("")
  const shown = narrowSections(sections, search)

  return (
    <>
      {/* Below lg: one dropdown */}
      <label className="flex flex-col gap-1 lg:hidden">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.chooseModule}</span>
        <select
          value={chosen.id}
          onChange={(event) => onChoose(event.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] text-on-surface"
        >
          {sections.map((section) => (
            <optgroup key={section.id} label={section.label}>
              {section.modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title} ({module.total})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* From lg: the list beside the prompts */}
      <nav
        aria-label={ADMIN_PROMPT_MESSAGES.navHeading}
        className="hidden flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
      >
        <div className="px-1">
          <h2 className="text-[14px] font-bold text-on-surface">{ADMIN_PROMPT_MESSAGES.navHeading}</h2>
          <p className="text-[12px] text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.navHint}</p>
        </div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("")
              if (event.key === "Enter" && shown[0]?.modules[0]) onChoose(shown[0].modules[0].id)
            }}
            placeholder={ADMIN_PROMPT_MESSAGES.searchModules}
            aria-label={ADMIN_PROMPT_MESSAGES.searchModules}
            className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-9 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear the search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-outline hover:bg-surface-container hover:text-on-surface"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {shown.length === 0 && <p className="px-1 text-[13px] text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.noModuleMatch}</p>}
        {shown.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            <h3 className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-outline">{section.label}</h3>
            <ul className="flex flex-col gap-0.5">
              {section.modules.map((module) => {
                const Icon = module.icon
                const isChosen = module.id === chosen.id
                return (
                  <li key={module.id}>
                    <button
                      type="button"
                      onClick={() => onChoose(module.id)}
                      aria-current={isChosen ? "page" : undefined}
                      title={module.description}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${
                        isChosen ? "bg-primary-fixed/60 text-primary" : "text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isChosen ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{module.title}</span>
                      <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        {module.total}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}
