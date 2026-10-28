"use client"

import React from "react"
import Link from "next/link"
import { Briefcase } from "lucide-react"
import type { MeetingPlan } from "@/types/meetingPlanner"

/**
 * The client project a meeting is about, as a small tag wherever the meeting is listed: the
 * project's name in words beside the icon, its client in the tooltip, and nothing for a meeting
 * connected to none. Given `linked`, it opens the project's own page.
 */
export const ProjectBadge: React.FC<{ meeting: Pick<MeetingPlan, "project">; linked?: boolean; className?: string }> = ({
  meeting,
  linked = false,
  className = "",
}) => {
  const project = meeting.project
  if (!project) return null
  const title = `Client project: ${project.name}${project.clientName ? ` (${project.clientName})` : ""}`
  const classes = `inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[10.5px] font-bold text-on-primary-fixed-variant ${className}`
  const body = (
    <>
      <Briefcase size={11} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{project.name}</span>
      <span className="sr-only">. {title}</span>
    </>
  )
  return linked ? (
    <Link href={`/client-projects/${project.id}`} title={title} className={`${classes} hover:underline`}>
      {body}
    </Link>
  ) : (
    <span title={title} className={classes}>
      {body}
    </span>
  )
}
