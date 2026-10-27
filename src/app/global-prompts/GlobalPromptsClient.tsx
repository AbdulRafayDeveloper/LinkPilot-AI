"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Award, BriefcaseBusiness, FolderKanban, GraduationCap, Handshake, MessageSquareQuote, Sparkles, UserRound, type LucideIcon } from "lucide-react"
import { GlobalPromptsPage, PromptCards } from "@/components/global-prompts/GlobalPromptsPage"
import { ProfileSearchPanel } from "@/components/my-profile/ProfileSearchPanel"
import { SectionTab } from "@/components/my-profile/SectionTab"
import { requestApi } from "@/lib/apiClient"
import { GLOBAL_PROMPTS_ENDPOINT, GLOBAL_PROMPTS_LINK, SHARED_GLOBAL_PROMPTS } from "@/constants/globalPrompts"
import { DEFAULT_MY_PROFILE_TAB, isMyProfileTab, MY_PROFILE_ENDPOINT, MY_PROFILE_TABS, PROFILE_INFO_TAB, sectionById } from "@/constants/profileSections"
import type { ProfileSearchState } from "@/types/myProfile"

const TAB_ICONS: Record<string, LucideIcon> = {
  profile: UserRound,
  experience: BriefcaseBusiness,
  projects: FolderKanban,
  skills: Sparkles,
  services: Handshake,
  education: GraduationCap,
  certifications: Award,
  reviews: MessageSquareQuote,
}

interface ProfileOverview {
  counts: Record<string, number>
  search: ProfileSearchState
}

/**
 * My AI Profile: what a person tells the system about themselves so every tool writes as them.
 * Profile Info is the free text the tools quote today; Experience, Projects, Skills, Services,
 * Education, Certifications and Reviews hold as many entries as the person adds
 * (constants/profileSections.ts). Everything here is the person's own account's, and all of it is saved
 * for search as Gemini vectors, which the line above the tabs reports on. The open tab is in the
 * address (`?tab=`), so a reload or a link opens the same one.
 */
export default function GlobalPromptsClient() {
  const router = useRouter()
  const asked = useSearchParams().get("tab")
  const tab = isMyProfileTab(asked) ? asked : DEFAULT_MY_PROFILE_TAB
  const current = MY_PROFILE_TABS.find((entry) => entry.id === tab) ?? MY_PROFILE_TABS[0]
  const section = sectionById(tab)
  // Replaced rather than pushed, so Back still leaves the page
  const choose = (next: string) => router.replace(next === DEFAULT_MY_PROFILE_TAB ? "?" : `?tab=${next}`, { scroll: false })

  const [overview, setOverview] = useState<ProfileOverview | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const hasCaughtUp = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const { data } = await requestApi<ProfileOverview>(MY_PROFILE_ENDPOINT)
      setOverview(data)
      return data
    } catch {
      return null
    }
  }, [])

  // Saves for search whatever is not searchable yet; only what changed is sent to Gemini
  const catchUp = useCallback(async () => {
    setIsIndexing(true)
    try {
      const { data } = await requestApi<ProfileSearchState>(`${MY_PROFILE_ENDPOINT}/index`, { method: "POST" }, { retry: true })
      setOverview((before) => (before ? { ...before, search: data } : before))
    } catch {
      await refresh()
    } finally {
      setIsIndexing(false)
    }
  }, [refresh])

  useEffect(() => {
    const start = async () => {
      const data = await refresh()
      // Once a visit: a part that could not be saved before (or was written with another model) is tried again by itself
      if (data && !hasCaughtUp.current && data.search.configured && data.search.pending + data.search.failed > 0) {
        hasCaughtUp.current = true
        await catchUp()
      }
    }
    void start()
  }, [refresh, catchUp])

  const onChanged = useCallback(() => {
    void refresh()
  }, [refresh])

  return (
    <GlobalPromptsPage
      heading={GLOBAL_PROMPTS_LINK.title}
      intro="Everything about you that the tools use to write as you. It is yours alone: no other account or admin sees or changes it."
      icon={GLOBAL_PROMPTS_LINK.icon}
    >
      <ProfileSearchPanel state={overview?.search ?? null} isIndexing={isIndexing} onRetry={() => void catchUp()} />

      <div className="flex flex-col gap-2">
        {/* Eight tabs wrap onto a second row rather than running off a phone or a laptop's edge */}
        <div role="tablist" aria-label={GLOBAL_PROMPTS_LINK.title} className="flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-1">
          {MY_PROFILE_TABS.map((entry) => {
            const Icon = TAB_ICONS[entry.id] ?? UserRound
            const isChosen = entry.id === tab
            const count = overview?.counts[entry.id] ?? 0
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`profile-tab-${entry.id}`}
                aria-selected={isChosen}
                aria-controls={`profile-panel-${entry.id}`}
                onClick={() => choose(entry.id)}
                className={`inline-flex flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none ${
                  isChosen ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {entry.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isChosen ? "bg-primary-hover text-white" : "bg-surface-container-high text-outline"}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        {/* What the open tab is for, in one line */}
        <p className="px-1 text-[13px] text-on-surface-variant">{current.hint}</p>
      </div>

      <div id={`profile-panel-${tab}`} role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className="min-w-0">
        {tab === PROFILE_INFO_TAB || !section ? (
          <PromptCards
            note="Your profile is what the tools quote when they write about you, such as your experience, your projects and your numbers. It is yours alone: only your results use it, and no other account or admin sees or changes it."
            prompts={SHARED_GLOBAL_PROMPTS}
            endpoint={GLOBAL_PROMPTS_ENDPOINT}
            onEditorClosed={onChanged}
          />
        ) : (
          // Keyed by the section, so each tab opens on its own list rather than the last one's
          <SectionTab key={section.id} section={section} onChanged={onChanged} />
        )}
      </div>
    </GlobalPromptsPage>
  )
}
