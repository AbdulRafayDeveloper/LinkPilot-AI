"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Info, Loader2, Plus } from "lucide-react"
import { EntryCard } from "@/components/my-profile/EntryCard"
import { EntryFormDialog } from "@/components/my-profile/EntryFormDialog"
import { SortableList } from "@/components/ui/SortableList"
import { requestApi } from "@/lib/apiClient"
import { takeBrowserProjects } from "@/lib/browserProjects"
import { entryTitle, type EntryFields } from "@/lib/profileSections"
import { MY_PROFILE_ENDPOINT, MY_PROFILE_MESSAGES, type ProfileSection } from "@/constants/profileSections"
import type { ProfileEntry } from "@/types/myProfile"

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

interface SectionTabProps {
  section: ProfileSection
  // Told after anything is added, changed or removed, so the counts and the search line follow (keep it stable)
  onChanged: () => void
}

/**
 * One section of My AI Profile (Experience, Projects, Skills …): every entry the person has added, in
 * their order, each on its own card, with Add, Edit, Delete and a handle to drag it into place. The
 * entries are saved to their account (services/myProfile/entries.ts) and saved for search as they
 * are saved; a card says whether it can be found yet.
 */
export const SectionTab: React.FC<SectionTabProps> = ({ section, onChanged }) => {
  const [entries, setEntries] = useState<ProfileEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // undefined: the form is closed; null: adding; an entry: editing that one
  const [editing, setEditing] = useState<ProfileEntry | null | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const endpoint = `${MY_PROFILE_ENDPOINT}/${section.id}`

  const load = useCallback(async () => {
    try {
      const { data } = await requestApi<{ entries: ProfileEntry[] }>(endpoint)
      setEntries(data.entries)
      setLoadError(null)
    } catch (error: unknown) {
      setLoadError(messageOf(error, MY_PROFILE_MESSAGES.loadFailed))
    }
  }, [endpoint])

  useEffect(() => {
    let isLive = true
    const start = async () => {
      // Projects kept in this browser before they were saved to accounts are brought over once
      const kept = section.id === "projects" ? takeBrowserProjects() : null
      if (kept && kept.entries.length > 0) {
        try {
          await requestApi(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries: kept.entries }) }, { idempotent: true })
          kept.forget()
          if (isLive) setNotice(MY_PROFILE_MESSAGES.importedProjects(kept.entries.length))
          onChanged()
        } catch (error: unknown) {
          if (isLive) setNotice(messageOf(error, MY_PROFILE_MESSAGES.saveFailed))
        }
      }
      if (isLive) await load()
    }
    void start()
    return () => {
      isLive = false
    }
  }, [endpoint, load, onChanged, section.id])

  const save = async (fields: EntryFields) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        const { data } = await requestApi<{ entry: ProfileEntry }>(`${endpoint}/${editing.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }) })
        setEntries((current) => (current ?? []).map((entry) => (entry.id === data.entry.id ? data.entry : entry)))
      } else {
        const { data } = await requestApi<{ entries: ProfileEntry[] }>(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }) }, { idempotent: true })
        setEntries((current) => [...data.entries, ...(current ?? [])])
      }
      setEditing(undefined)
      onChanged()
    } catch (error: unknown) {
      setSaveError(messageOf(error, MY_PROFILE_MESSAGES.saveFailed))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (entry: ProfileEntry) => {
    setBusyId(entry.id)
    try {
      await requestApi(`${endpoint}/${entry.id}`, { method: "DELETE" })
      setEntries((current) => (current ?? []).filter((kept) => kept.id !== entry.id))
      onChanged()
    } catch (error: unknown) {
      setNotice(messageOf(error, MY_PROFILE_MESSAGES.deleteFailed))
    } finally {
      setBusyId(null)
    }
  }

  const reorder = async (ids: string[]) => {
    const before = entries ?? []
    const byId = new Map(before.map((entry) => [entry.id, entry]))
    setEntries(ids.map((id) => byId.get(id)).filter((entry): entry is ProfileEntry => Boolean(entry)))
    try {
      await requestApi(`${endpoint}/order`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderedIds: ids }) })
    } catch {
      setNotice(MY_PROFILE_MESSAGES.moveFailed)
      await load()
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={() => {
        setSaveError(null)
        setEditing(null)
      }}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
    >
      <Plus size={16} aria-hidden="true" />
      Add {section.noun}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-on-surface-variant">
          {entries === null ? "" : `${entries.length} ${entries.length === 1 ? section.noun : `${section.noun}s`}`}
        </p>
        {addButton}
      </div>

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-secondary/30 bg-secondary-fixed px-3 py-2 text-[13px] text-on-secondary-fixed-variant">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-error/30 bg-error-container/40 px-6 py-8 text-center">
          <p className="text-[14px] text-on-error-container">{loadError}</p>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high">
            Try again
          </button>
        </div>
      ) : entries === null ? (
        <p className="flex items-center gap-2 px-1 py-6 text-[13px] text-on-surface-variant">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading...
        </p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <p className="max-w-md text-[14px] text-on-surface-variant">
            No {section.noun}s yet. {section.hint}
          </p>
          {addButton}
        </div>
      ) : (
        <SortableList
          items={entries}
          getId={(entry) => entry.id}
          getLabel={(entry) => entryTitle(section, entry.fields)}
          onReorder={(ids) => void reorder(ids)}
          disabled={busyId !== null || editing !== undefined}
          label={`${section.label}, in order`}
          itemNoun={`${section.noun}s`}
          className="flex flex-col gap-3"
          renderItem={(entry, handle) => (
            <EntryCard
              section={section}
              entry={entry}
              handle={handle}
              isBusy={busyId === entry.id}
              onEdit={() => {
                setSaveError(null)
                setEditing(entry)
              }}
              onRemove={() => void remove(entry)}
            />
          )}
        />
      )}

      {editing !== undefined && (
        <EntryFormDialog section={section} editing={editing?.fields ?? null} isSaving={isSaving} error={saveError} onSave={(fields) => void save(fields)} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}
