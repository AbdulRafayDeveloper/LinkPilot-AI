"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { FolderKanban, Loader2 } from "lucide-react"
import { ProjectTasks } from "@/components/client-projects/ProjectTasks"
import { requestApi } from "@/lib/apiClient"
import { SITE_LOGO_PNG, SITE_NAME } from "@/config/site"
import { PUBLIC_PROJECT_ENDPOINT, PUBLIC_PROJECT_MESSAGES } from "@/constants/clientProjectTasks"
import type { PublicProject } from "@/types/clientProjectTasks"

/**
 * What a project's read-only link opens, for someone who is not signed in: the project, the client
 * it is for and its tasks with their images and voice notes. There is nothing here that changes
 * anything, and nothing that says whose account it is or what else that client has.
 */
export default function PublicProjectClient({ token }: { token: string }) {
  const [project, setProject] = useState<PublicProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<PublicProject>(`${PUBLIC_PROJECT_ENDPOINT}/${token}`, { signal: controller.signal })
      .then(({ data }) => setProject(data))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PUBLIC_PROJECT_MESSAGES.invalid)
      })
    return () => controller.abort()
  }, [token])

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface">
      <header className="border-b border-outline-variant bg-white">
        <div className="mx-auto flex max-w-[900px] items-center gap-2 px-4 py-3">
          <Image src={SITE_LOGO_PNG} alt="" width={24} height={24} className="rounded-md" />
          <span className="text-[13px] font-semibold text-on-surface">{SITE_NAME}</span>
          <span className="ml-auto rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
            {PUBLIC_PROJECT_MESSAGES.readOnly}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-6">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-white px-4 py-16 text-center">
            <FolderKanban size={22} className="text-outline" aria-hidden="true" />
            <p className="text-sm text-on-surface-variant">{error}</p>
          </div>
        ) : !project ? (
          <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            Loading the project...
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-outline-variant bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-xl font-bold text-on-surface">{project.name}</h1>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    project.status === "completed" ? "bg-success-container text-on-success-container" : "bg-secondary-fixed text-on-secondary-fixed-variant"
                  }`}
                >
                  {project.status === "completed" ? "Completed" : "Active"}
                </span>
              </div>
              {project.clientName && <p className="mt-1 text-[13px] text-on-surface-variant">For {project.clientName}</p>}
              {project.description && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-on-surface-variant">{project.description}</p>}
            </section>

            <section aria-label="The tasks on this project" className="flex flex-col gap-2">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-outline">
                Tasks
                {project.tasks.length > 0 && (
                  <span className="ml-2 font-medium normal-case tracking-normal text-on-surface-variant">
                    {project.tasks.filter((task) => task.status === "done").length} of {project.tasks.length} done
                  </span>
                )}
              </h2>
              <ProjectTasks tasks={project.tasks} readOnly />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
