"use client"

import React, { useState } from "react"

/**
 * An account shown as a circle: its profile photo, or its initials until it has one. The header's
 * account menu and Account Settings both draw it, so a photo that is saved shows in both at once.
 *
 * The photo is a plain img element, like every other stored image here (Personal Drive, Post Image
 * Creator, a task's images): the app's own route answers with a short-lived signed link on the
 * storage host rather than something next/image can be pointed at. A photo that can't be loaded
 * falls back to the initials instead of leaving an empty circle.
 */

export type AvatarSize = "sm" | "md" | "lg"

const SIZES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[12px]",
  md: "h-11 w-11 text-[15px]",
  lg: "h-20 w-20 text-[26px]",
}

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"

interface AccountAvatarProps {
  name: string
  photo: string | null
  size?: AvatarSize
  // An admin's circle is the brand violet, a user's the lighter fixed tint, as the menu always was
  isAdmin?: boolean
  className?: string
}

export const AccountAvatar: React.FC<AccountAvatarProps> = ({ name, photo, size = "sm", isAdmin = false, className = "" }) => {
  const [hasFailed, setHasFailed] = useState(false)
  const shell = `flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${SIZES[size]} ${className}`

  if (photo && !hasFailed) {
    return (
      <span className={`${shell} border border-outline-variant bg-surface-container`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={name} onError={() => setHasFailed(true)} className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span className={`${shell} ${isAdmin ? "bg-primary text-white" : "bg-primary-fixed text-on-primary-fixed-variant"}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
