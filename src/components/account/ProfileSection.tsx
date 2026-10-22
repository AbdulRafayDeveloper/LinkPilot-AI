"use client"

import React, { useRef, useState } from "react"
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { AccountAvatar } from "@/components/ui/AccountAvatar"
import { removeAccountPhoto, uploadAccountPhoto } from "@/lib/accountPhotoUpload"
import { requestApi } from "@/lib/apiClient"
import { updateCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES, ACCOUNT_PHOTO_ACCEPT } from "@/constants/account"
import { NAME_MAX_LENGTH } from "@/constants/auth"
import type { Viewer } from "@/types/auth"

/**
 * The person's name and photo. Both are saved one at a time with a small write of their own, and
 * both are put straight into the account every page already reads (`updateCurrentUser`), so the
 * header's menu shows the new name or photo the moment it is saved rather than after a reload.
 */

interface ProfileSectionProps {
  user: Viewer
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ user }) => {
  const [name, setName] = useState(user.name)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingPhoto, setIsSavingPhoto] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const typed = name.trim()
  const canSaveName = typed.length > 0 && typed.length <= NAME_MAX_LENGTH && typed !== user.name && !isSavingName
  const isAdmin = user.role === "admin"

  const say = (message: string) => {
    setSaved(message)
    setProblem(null)
  }

  const saveName = async () => {
    if (!canSaveName) return
    setIsSavingName(true)
    setProblem(null)
    setSaved(null)
    try {
      const { data } = await requestApi<{ name: string }>(ACCOUNT_ENDPOINTS.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: typed }),
      })
      updateCurrentUser({ name: data.name })
      setName(data.name)
      say(ACCOUNT_MESSAGES.nameSaved)
    } catch (error: unknown) {
      setProblem(error instanceof Error ? error.message : ACCOUNT_MESSAGES.nameFailed)
    } finally {
      setIsSavingName(false)
    }
  }

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setIsSavingPhoto(true)
    setProblem(null)
    setSaved(null)
    try {
      const photo = await uploadAccountPhoto(file)
      updateCurrentUser({ photo })
      say(ACCOUNT_MESSAGES.photoSaved)
    } catch (error: unknown) {
      setProblem(error instanceof Error ? error.message : ACCOUNT_MESSAGES.photoUploadFailed)
    } finally {
      setIsSavingPhoto(false)
      if (picker.current) picker.current.value = ""
    }
  }

  const dropPhoto = async () => {
    setIsSavingPhoto(true)
    setProblem(null)
    setSaved(null)
    try {
      await removeAccountPhoto()
      updateCurrentUser({ photo: null })
      say(ACCOUNT_MESSAGES.photoRemoved)
    } catch (error: unknown) {
      setProblem(error instanceof Error ? error.message : ACCOUNT_MESSAGES.photoUploadFailed)
    } finally {
      setIsSavingPhoto(false)
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-4 sm:p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-bold text-on-surface">{ACCOUNT_MESSAGES.profileTitle}</h2>
        <p className="mt-1 text-[13px] text-on-surface-variant">{ACCOUNT_MESSAGES.profileHint}</p>
      </div>

      {/* The photo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AccountAvatar name={user.name} photo={user.photo} size="lg" isAdmin={isAdmin} />
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-[13px] font-semibold text-on-surface">{ACCOUNT_MESSAGES.photoTitle}</p>
          <p className="text-[12px] text-on-surface-variant">{ACCOUNT_MESSAGES.photoHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={isSavingPhoto}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
            >
              {isSavingPhoto ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
              {user.photo ? ACCOUNT_MESSAGES.photoChange : ACCOUNT_MESSAGES.photoAdd}
            </button>
            {user.photo && (
              <button
                type="button"
                onClick={dropPhoto}
                disabled={isSavingPhoto}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-error transition-colors hover:bg-error-container/40 disabled:opacity-60"
              >
                <Trash2 size={15} aria-hidden="true" />
                {ACCOUNT_MESSAGES.photoRemove}
              </button>
            )}
          </div>
          <input
            ref={picker}
            type="file"
            accept={ACCOUNT_PHOTO_ACCEPT}
            onChange={(event) => void choosePhoto(event.target.files?.[0])}
            className="hidden"
          />
        </div>
      </div>

      {/* The name */}
      <div className="flex flex-col gap-2">
        <label htmlFor="account-name" className="text-[13px] font-semibold text-on-surface">
          Your name
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="account-name"
            type="text"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName()
            }}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="The name shown in the header"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={!canSaveName}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-50 sm:shrink-0"
          >
            {isSavingName ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            Save name
          </button>
        </div>
      </div>

      {saved && <p className="rounded-xl bg-success-container px-3 py-2 text-[13px] font-medium text-on-success-container">{saved}</p>}
      {problem && <p className="rounded-xl bg-error-container px-3 py-2 text-[13px] font-medium text-on-error-container">{problem}</p>}
    </section>
  )
}
