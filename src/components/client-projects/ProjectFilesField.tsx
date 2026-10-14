"use client"

import React, { useRef, useState } from "react"
import { FileArchive, File as FileIcon, FileText, Film, ImageIcon, Loader2, Music, Paperclip, Trash2 } from "lucide-react"
import { fileProblem, uploadProjectFile } from "@/lib/projectFileUpload"
import { PROJECT_MAX_FILES, PROJECT_TASK_MESSAGES, type ProjectFileCategory } from "@/constants/clientProjectTasks"
import { FILE_PICKER_ACCEPT } from "@/constants/importantFiles"
import type { ProjectFileView } from "@/types/clientProjectTasks"

interface ProjectFilesFieldProps {
  files: ProjectFileView[]
  /**
   * One finished file, to be added to the list. It is an **add** rather than a whole new list on
   * purpose: several files go up at once, and each one lands whenever its own upload finishes, so
   * the parent appends with a state updater and two finishing together cannot drop each other.
   */
  onAdd: (file: ProjectFileView) => void
  onRemove: (assetId: string) => void
  onError: (message: string | null) => void
  // Counts the files still on their way, so an item is never saved without one of them
  onUploading: (count: number) => void
  // Where the file's own routes live: the project's, or a shared link's
  endpoint: string
  disabled?: boolean
  canAttach?: boolean
}

const ICONS: Record<ProjectFileCategory, React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>> = {
  image: ImageIcon,
  pdf: FileText,
  word: FileText,
  text: FileText,
  video: Film,
  audio: Music,
  archive: FileArchive,
}

/** A size a person reads, rather than a number of bytes. */
export const fileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** One file's own icon, by what the app placed it as. */
export const FileKindIcon: React.FC<{ category: ProjectFileCategory; className?: string }> = ({ category, className }) => {
  const Icon = ICONS[category] ?? FileIcon
  return <Icon size={14} className={className} aria-hidden={true} />
}

/**
 * The files on one item while it is being written: pick them, watch them go up, take one off.
 *
 * A file goes in chunks through the app (`lib/projectFileUpload.ts`), so a 200 MB video is possible
 * at all; the bar is what that costs the person in waiting. Nothing is on the item until the item
 * itself is saved, so taking a file off here before saving simply never attaches it.
 */
/** One file on its way up: what it is called and how far it has got. */
interface Going {
  key: string
  name: string
  fraction: number
}

export const ProjectFilesField: React.FC<ProjectFilesFieldProps> = ({ files, onAdd, onRemove, onError, onUploading, endpoint, disabled, canAttach = true }) => {
  const input = useRef<HTMLInputElement | null>(null)
  // What is still going up, by a key of its own, each with how far it has got
  const [going, setGoing] = useState<Going[]>([])
  /**
   * The same list in a ref, so the next one is worked out **before** the state is set rather than
   * inside an updater. React runs an updater while it renders, and telling the parent how many
   * files are still going from in there is a setState during another component's render, which is
   * what React warns about ("Cannot update a component while rendering a different component") and
   * what the same rule in Daily Tasks' picking already says not to do.
   */
  const list = useRef<Going[]>([])

  /** The one place the list changes: the ref, the state and the parent's count, in that order. */
  const put = (next: Going[]) => {
    list.current = next
    setGoing(next)
    onUploading(next.length)
  }

  const room = PROJECT_MAX_FILES - files.length - going.length

  const send = async (chosen: File[]) => {
    const taking = chosen.slice(0, Math.max(0, room))
    if (chosen.length > taking.length) onError(PROJECT_TASK_MESSAGES.tooManyFiles)
    if (taking.length === 0) return

    const started = taking.map((file, index) => ({ key: `${Date.now()}-${index}-${file.name}`, name: file.name, fraction: 0, file }))
    put([...list.current, ...started.map(({ key, name, fraction }) => ({ key, name, fraction }))])

    for (const { key, file } of started) {
      const problem = fileProblem(file)
      if (problem) {
        onError(problem)
        put(list.current.filter((row) => row.key !== key))
        continue
      }
      try {
        const stored = await uploadProjectFile(file, {
          endpoint,
          onProgress: (fraction) => put(list.current.map((row) => (row.key === key ? { ...row, fraction } : row))),
        })
        onAdd(stored)
        onError(null)
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : PROJECT_TASK_MESSAGES.fileUploadFailed)
      } finally {
        put(list.current.filter((row) => row.key !== key))
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || !canAttach || room <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip size={13} aria-hidden="true" />
          Attach files
        </button>
        <span className="text-[11px] text-outline">
          {canAttach
            ? `Word, PDF, text, images, video, audio or a zip. Up to ${PROJECT_MAX_FILES} files${room > 0 ? `, ${room} left` : ""}.`
            : PROJECT_TASK_MESSAGES.fileStorageUnavailable}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? [])
            event.target.value = ""
            onError(null)
            void send(chosen)
          }}
        />
      </div>

      {(files.length > 0 || going.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file) => (
            <li key={file.assetId} className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-2.5 py-1.5">
              <FileKindIcon category={file.category} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-on-surface" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-[11px] text-outline">{fileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(file.assetId)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded-md p-1 text-outline transition-colors hover:bg-error-container hover:text-error"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
          {going.map((row) => (
            <li key={row.key} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5">
              <Loader2 size={13} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-on-surface" title={row.name}>
                {row.name}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-primary">{Math.round(row.fraction * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
