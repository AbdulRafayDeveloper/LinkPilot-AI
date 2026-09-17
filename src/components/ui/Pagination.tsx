"use client"

import React from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

// Pages either side of the current one that are always offered, besides the first and the last
const NEIGHBOURS = 1

type PageSlot = number | "gap"

/**
 * The page numbers to offer: always the first and the last, the current page and its neighbours,
 * and a gap wherever pages are skipped. A gap that would hide a single page shows that page
 * instead, so "1 … 3" never happens where "1 2 3" fits.
 */
export function pageSlots(page: number, totalPages: number): PageSlot[] {
  const shown = new Set<number>([1, totalPages])
  for (let offset = -NEIGHBOURS; offset <= NEIGHBOURS; offset++) shown.add(page + offset)
  const pages = [...shown].filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b)

  const slots: PageSlot[] = []
  pages.forEach((number, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && number - previous === 2) slots.push(previous + 1)
    else if (previous !== undefined && number - previous > 2) slots.push("gap")
    slots.push(number)
  })
  return slots
}

const baseButton =
  "inline-flex h-8 items-center justify-center rounded-lg border text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
const idleButton = "border-outline-variant bg-white text-on-surface hover:bg-surface-container-high"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  // While a page is on its way, the controls wait for it
  isLoading?: boolean
  label?: string
}

/**
 * Page navigation for a list paged on the server: Previous, every page number worth offering (with
 * gaps for the rest), and Next. Any number goes straight to that page.
 */
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, isLoading = false, label = "Pages" }) => {
  const go = (target: number) => {
    if (target !== page && target >= 1 && target <= totalPages) onPageChange(target)
  }

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={() => go(page - 1)} disabled={page <= 1 || isLoading} className={`${baseButton} ${idleButton} gap-1 px-3`}>
        <ChevronLeft size={14} aria-hidden="true" />
        Previous
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {pageSlots(page, totalPages).map((slot, index) =>
          slot === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[12px] text-outline" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              onClick={() => go(slot)}
              disabled={isLoading && slot !== page}
              aria-current={slot === page ? "page" : undefined}
              aria-label={`Page ${slot}${slot === totalPages ? ", the last page" : ""}`}
              className={`${baseButton} min-w-8 px-2 ${
                slot === page ? "border-primary bg-primary text-white hover:bg-primary" : idleButton
              }`}
            >
              {slot}
            </button>
          )
        )}
        <span className="ml-1 flex items-center gap-1.5 text-[12px] text-on-surface-variant" aria-live="polite">
          {isLoading && <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />}
          <span className="sr-only">
            Page {page} of {totalPages}
          </span>
        </span>
      </div>

      <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages || isLoading} className={`${baseButton} ${idleButton} gap-1 px-3`}>
        Next
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  )
}
