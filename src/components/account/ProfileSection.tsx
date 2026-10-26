"use client"

import React, { useRef, useState } from "react"
import { Check, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react"
import { AccountAvatar } from "@/components/ui/AccountAvatar"
import { removeAccountPhoto, uploadAccountPhoto } from "@/lib/accountPhotoUpload"
import { requestApi } from "@/lib/apiClient"
import { updateCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES, ACCOUNT_PHOTO_ACCEPT } from "@/constants/account"
import { NAME_MAX_LENGTH } from "@/constants/auth"
import type { Viewer } from "@/types/auth"
import { SETTINGS_FIELD, SETTINGS_LABEL, SETTINGS_PRIMARY_BUTTON, SETTINGS_SECONDARY_BUTTON, SettingsCard } from "./SettingsCard"

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
    <SettingsCard
      title={ACCOUNT_MESSAGES.profileTitle}
      description={ACCOUNT_MESSAGES.profileHint}
      icon={UserRound}
      notice={problem ? { tone: "problem", text: problem } : saved ? { tone: "saved", text: saved } : null}
      footer={
        <button type="button" onClick={saveName} disabled={!canSaveName} className={SETTINGS_PRIMARY_BUTTON}>
          {isSavingName ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          Save name
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* The photo: the picture, and what can be done with it beside it */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <AccountAvatar name={user.name} photo={user.photo} size="lg" isAdmin={isAdmin} />
          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <p className="text-[13px] font-semibold text-on-surface">{ACCOUNT_MESSAGES.photoTitle}</p>
              <p className="text-[12px] text-on-surface-variant">{ACCOUNT_MESSAGES.photoHint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => picker.current?.click()} disabled={isSavingPhoto} className={SETTINGS_SECONDARY_BUTTON}>
                {isSavingPhoto ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
                {user.photo ? ACCOUNT_MESSAGES.photoChange : ACCOUNT_MESSAGES.photoAdd}
              </button>
              {user.photo && (
                <button type="button" onClick={dropPhoto} disabled={isSavingPhoto} className={`${SETTINGS_SECONDARY_BUTTON} text-error hover:bg-error-container/40`}>
                  <Trash2 size={15} aria-hidden="true" />
                  {ACCOUNT_MESSAGES.photoRemove}
                </button>
              )}
            </div>
            <input ref={picker} type="file" accept={ACCOUNT_PHOTO_ACCEPT} onChange={(event) => void choosePhoto(event.target.files?.[0])} className="hidden" />
          </div>
        </div>

        {/* The name */}
        <div className="max-w-md">
          <label htmlFor="account-name" className={SETTINGS_LABEL}>
            Full name
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName()
            }}
            className={SETTINGS_FIELD}
            placeholder="The name shown in the header"
          />
          <p className="mt-1.5 text-[12px] text-outline">Shown in the header, the account menu and to the admins.</p>
        </div>
      </div>
    </SettingsCard>
  )
}
