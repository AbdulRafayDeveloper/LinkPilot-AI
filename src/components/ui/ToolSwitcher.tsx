"use client"

import React, { useId, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CornerDownLeft, Search } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"

// Everything the sidebar links to, in sidebar order
const DESTINATIONS = [...LINKEDIN_TOOLS, GLOBAL_PROMPTS_LINK]

const matches = (query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return DESTINATIONS.filter((destination) => {
    const text = `${destination.title} ${destination.description}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

/**
 * Quick navigation for the whole app (opened from the header or with Ctrl/⌘+K): type to
 * filter the tools, move with the arrow keys and press Enter to open one.
 */
export const ToolSwitcher: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router = useRouter()
  const pathname = usePathname()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const results = matches(query)
  const optionId = (index: number) => `${listId}-option-${index}`

  const open = (href: string) => {
    onClose()
    if (href !== pathname) router.push(href)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      setActiveIndex((index) => (index + step + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      open(results[Math.min(activeIndex, results.length - 1)].href)
    }
  }

  return (
    <Modal title="Jump to a tool" size="compact" onClose={onClose} initialFocusRef={inputRef}>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
          <Search size={16} className="shrink-0 text-outline" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
            aria-label="Search tools"
            placeholder="Search tools..."
            className="w-full bg-transparent py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none"
          />
        </label>

        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">No tool matches &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Tools" className="flex flex-col gap-1">
            {results.map(({ id, title, description, icon: Icon, href }, index) => {
              const isActive = index === activeIndex
              const isCurrent = href === pathname
              return (
                <li
                  key={id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => open(href)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                    isActive ? "bg-primary-container text-on-primary-container" : "text-on-surface"
                  }`}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight truncate">{title}</span>
                    <span className={`block text-xs leading-tight mt-0.5 truncate ${isActive ? "text-on-primary-container/80" : "text-outline"}`}>
                      {description}
                    </span>
                  </span>
                  {isCurrent && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? "text-on-primary-container/80" : "text-outline"}`}>
                      Current
                    </span>
                  )}
                  {isActive && !isCurrent && <CornerDownLeft size={14} className="shrink-0 opacity-70" aria-hidden="true" />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
