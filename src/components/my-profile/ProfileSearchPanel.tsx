"use client"

import React, { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RotateCw, Search } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { MY_PROFILE_ENDPOINT, MY_PROFILE_MESSAGES, PROFILE_SEARCH_MAX_LENGTH, sectionById } from "@/constants/profileSections"
import type { ProfileSearchMatch, ProfileSearchState } from "@/types/myProfile"

interface ProfileSearchPanelProps {
  state: ProfileSearchState | null
  isIndexing: boolean
  onRetry: () => void
}

const sectionName = (id: string) => (id === "profile-info" ? "Profile Info" : (sectionById(id)?.label ?? id))

/**
 * How the person's whole profile stands in search (every entry and Profile Info, as Gemini vectors),
 * with Try again when any part could not be saved and the reason Gemini gave, then a search of their
 * own profile, the way a tool will look things up in it, to see that it works.
 */
export const ProfileSearchPanel: React.FC<ProfileSearchPanelProps> = ({ state, isIndexing, onRetry }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [matches, setMatches] = useState<ProfileSearchMatch[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!question.trim()) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const { data } = await requestApi<{ matches: ProfileSearchMatch[] }>(`${MY_PROFILE_ENDPOINT}/search?q=${encodeURIComponent(question.trim())}`)
      setMatches(data.matches)
    } catch (error: unknown) {
      setSearchError(error instanceof Error && error.message ? error.message : MY_PROFILE_MESSAGES.searchFailed)
    } finally {
      setIsSearching(false)
    }
  }

  if (!state) return null
  if (!state.configured) {
    return <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-[13px] text-on-surface-variant">{MY_PROFILE_MESSAGES.indexUnavailable(state.missing.join(", "))}</p>
  }

  const waiting = state.pending + state.failed
  const tone = state.failed > 0 ? "border-error/30 bg-error-container/40 text-on-error-container" : waiting > 0 ? "border-secondary/30 bg-secondary-fixed text-on-secondary-fixed-variant" : "border-success/30 bg-success-container/50 text-on-success-container"
  const line = isIndexing
    ? MY_PROFILE_MESSAGES.indexing
    : state.failed > 0
      ? MY_PROFILE_MESSAGES.indexFailed(state.failed)
      : state.pending > 0
        ? MY_PROFILE_MESSAGES.indexPending(state.pending)
        : state.total > 0
          ? `${MY_PROFILE_MESSAGES.indexReady} ${state.total} ${state.total === 1 ? "part" : "parts"} of your profile can be found.`
          : MY_PROFILE_MESSAGES.indexReady

  return (
    <section aria-label="Search" className="flex flex-col gap-2">
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[13px] ${tone}`}>
        {isIndexing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : state.failed > 0 ? <AlertTriangle size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
        <span className="min-w-0 flex-1 font-semibold">{line}</span>
        {waiting > 0 && !isIndexing && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-outline-variant px-2.5 py-1 text-[12px] font-semibold hover:bg-surface-container-lowest/60">
            <RotateCw size={13} aria-hidden="true" />
            {MY_PROFILE_MESSAGES.indexRetry}
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-semibold hover:bg-surface-container-lowest/60"
        >
          <Search size={13} aria-hidden="true" />
          Test search
          <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {state.failed > 0 && !isIndexing && state.errors.map((error) => (
        <p key={error} className="px-1 text-[12px] leading-relaxed text-error">
          {error}
        </p>
      ))}

      {isOpen && (
        <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <form onSubmit={(event) => void search(event)} className="flex flex-col gap-2">
            <label htmlFor="profile-search" className="text-[13px] font-semibold text-on-surface">
              {MY_PROFILE_MESSAGES.searchLabel}
            </label>
            <p className="text-[12px] text-on-surface-variant">{MY_PROFILE_MESSAGES.searchHint}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="profile-search"
                value={question}
                maxLength={PROFILE_SEARCH_MAX_LENGTH}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={MY_PROFILE_MESSAGES.searchPlaceholder}
                className="h-11 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <button type="submit" disabled={isSearching || !question.trim()} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
                {isSearching ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
                Search
              </button>
            </div>
          </form>
          {searchError && <p className="text-[13px] text-error">{searchError}</p>}
          {matches && matches.length === 0 && <p className="text-[13px] text-on-surface-variant">{MY_PROFILE_MESSAGES.searchNothing}</p>}
          {matches && matches.length > 0 && (
            <ol className="flex flex-col gap-2">
              {matches.map((match, index) => (
                <li key={`${match.sourceId}-${index}`} className="rounded-xl border border-outline-variant/70 bg-surface-container-low px-3 py-2">
                  <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-outline">
                    {sectionName(match.section)}
                    <span className="rounded-full bg-primary-fixed px-2 py-0.5 normal-case tracking-normal text-on-primary-fixed-variant">{Math.round(match.score * 100)}% match</span>
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[13px] text-on-surface [overflow-wrap:anywhere]">{match.text}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
