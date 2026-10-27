"use client"

import React, { useId } from "react"
import { RichTextEditor, type RichTextImages } from "@/components/ui/RichTextEditor"
import { requestApi } from "@/lib/apiClient"
import { CONTENT_IMAGES_ENDPOINT } from "@/lib/contentImages"
import {
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_IMAGE_ACCEPT,
  CONTENT_IMAGE_MAX_BYTES,
  CONTENT_NAME_MAX_LENGTH,
  CONTENT_TEXT_SIZES,
  CONTENT_TYPE_MAX_LENGTH,
  DEFAULT_CONTENT_TEXT_SIZE,
  IMPORTANT_CONTENT_MESSAGES,
} from "@/constants/importantContent"
import { UNFILED_FOLDER_LABEL } from "@/constants/folders"
import type { ImportantContent, ImportantContentInput } from "@/types/importantContent"
import type { RecordFolder } from "@/types/folders"

/** Everything an entry is written with, every field present, as a dialog holds it while it is written. */
export type ContentForm = Required<ImportantContentInput>

export const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

/** The form an entry opens with, or an empty one: no name, no type, no folder, the default size. */
export const contentFormOf = (entry: ImportantContent | null): ContentForm =>
  entry
    ? { name: entry.name, description: entry.description, type: entry.type, textSize: entry.textSize ?? DEFAULT_CONTENT_TEXT_SIZE, folderId: entry.folder?.id ?? null }
    : { name: "", description: "", type: "", textSize: DEFAULT_CONTENT_TEXT_SIZE, folderId: null }

/** What the server would refuse anyway: a name and a type, and a description within the ceiling. */
export const isContentSaveable = (form: ContentForm) => Boolean(form.name.trim() && form.type.trim()) && form.description.length <= CONTENT_DESCRIPTION_MAX_LENGTH

/** Stores one picture through the app and answers the address the description names it by. */
async function uploadImage(file: File): Promise<string> {
  const { data } = await requestApi<{ src: string }>(CONTENT_IMAGES_ENDPOINT, { method: "POST", headers: { "Content-Type": file.type }, body: file }, { retry: true })
  return data.src
}

export const CONTENT_EDITOR_IMAGES: RichTextImages = {
  accept: CONTENT_IMAGE_ACCEPT,
  maxBytes: CONTENT_IMAGE_MAX_BYTES,
  upload: uploadImage,
  messages: {
    unsupported: IMPORTANT_CONTENT_MESSAGES.imageUnsupported,
    tooLarge: IMPORTANT_CONTENT_MESSAGES.imageTooLarge,
    failed: IMPORTANT_CONTENT_MESSAGES.imageUploadFailed,
    badAddress: IMPORTANT_CONTENT_MESSAGES.imageBadAddress,
  },
}

interface ContentFieldsProps {
  form: ContentForm
  onChange: <K extends keyof ContentForm>(key: K, value: ContentForm[K]) => void
  // The types already in use, suggested as the user types; any other type is fine too
  knownTypes: string[]
  // The folders the entry may be filed in, null while they load
  folders: RecordFolder[] | null
  nameRef?: React.RefObject<HTMLInputElement | null>
}

/**
 * The fields an entry is written with, shared by Important Content's own Add and Edit dialog and
 * by the dialog that moves a Quick Note here, so the two can never ask for different things: the
 * name, the type (free text, with the types already used as suggestions), **the folder it goes in**
 * (a plain dropdown of the account's folders, "No folder" by default, the folder an edited entry is
 * already in preselected), and the description on the visual editor with its text size and images.
 */
export const ContentFields: React.FC<ContentFieldsProps> = ({ form, onChange, knownTypes, folders, nameRef }) => {
  const typeListId = useId()
  const descriptionId = useId()
  const overLimit = form.description.length > CONTENT_DESCRIPTION_MAX_LENGTH
  // The folder an edited entry is in stays offered even if it was deleted while the dialog was open
  const folderOptions = folders && form.folderId && !folders.some((folder) => folder.id === form.folderId) ? [...folders, { id: form.folderId, name: "Folder no longer exists", recordCount: 0 }] : folders

  return (
    <>
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input
            ref={nameRef}
            name="name"
            value={form.name}
            maxLength={CONTENT_NAME_MAX_LENGTH}
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="e.g. Acme staging login"
            className={`${fieldClass} h-10`}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Type</span>
          <input
            name="type"
            value={form.type}
            maxLength={CONTENT_TYPE_MAX_LENGTH}
            onChange={(event) => onChange("type", event.target.value)}
            list={typeListId}
            placeholder="e.g. Credentials"
            autoComplete="off"
            className={`${fieldClass} h-10`}
            required
          />
          <datalist id={typeListId}>
            {knownTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>
            Folder <span className="font-normal text-outline">(optional)</span>
          </span>
          <select
            name="folder"
            value={form.folderId ?? ""}
            onChange={(event) => onChange("folderId", event.target.value || null)}
            disabled={folders === null}
            className={`${fieldClass} h-10 disabled:opacity-60`}
          >
            <option value="">{folders === null ? "Loading folders..." : UNFILED_FOLDER_LABEL}</option>
            {(folderOptions ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Not a <label> around the field: the toolbar's buttons can't sit inside one */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <label htmlFor={descriptionId} className={labelClass}>
            Description <span className="font-normal text-outline">(optional)</span>
          </label>
          <span className={`text-[11px] ${overLimit ? "font-semibold text-error" : "text-outline"}`}>
            {form.description.length.toLocaleString()} / {CONTENT_DESCRIPTION_MAX_LENGTH.toLocaleString()}
          </span>
        </span>
        <RichTextEditor
          id={descriptionId}
          value={form.description}
          maxLength={CONTENT_DESCRIPTION_MAX_LENGTH}
          onChange={(value) => onChange("description", value)}
          rows={12}
          placeholder="The text you want to keep: a login, a link, steps, anything. Use the buttons above for headings, lists, images and more."
          ariaLabel="Description"
          visual
          fill
          images={CONTENT_EDITOR_IMAGES}
          textSize={{ value: form.textSize, steps: CONTENT_TEXT_SIZES, onChange: (size) => onChange("textSize", size) }}
        />
      </div>
    </>
  )
}
