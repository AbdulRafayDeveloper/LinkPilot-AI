import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { ProjectFileUploadModel, type IProjectFileUpload } from "@/models/ProjectFileUpload"
import {
  PROJECT_FILE_CHUNK_BYTES,
  PROJECT_FILE_PART_BYTES,
  PROJECT_FILE_UPLOAD_HOURS,
  PROJECT_TASK_MESSAGES,
  maxBytesFor,
  type ProjectFileCategory,
} from "@/constants/clientProjectTasks"
import { ASSET_CATEGORY_IDS, categoryForContentType } from "@/constants/importantFiles"
import { groupIntoParts } from "@/lib/recordingParts"
import {
  abortMultipartUpload,
  completeMultipartUpload,
  deleteObject,
  getObjectBytes,
  isStorageConfigured,
  presignDownload,
  putObject,
  startMultipartUpload,
  uploadPartBytes,
} from "@/services/storage/s3"
import type { ProjectFile, ProjectFileProgress, ProjectFileUploadPlan, ProjectFileView } from "@/types/clientProjectTasks"

/**
 * The files on a client project's items: a Word document, a PDF, a video, anything the app can
 * place.
 *
 * **Why it is chunked rather than one request or a signed link to storage.** A serverless request
 * body is capped at 4.5 MB, so a 200 MB video cannot arrive in one piece; and the bucket's CORS
 * rule refuses browser uploads straight to S3 from the live site, so the Important Files path (a
 * presigned multipart upload) does not work here either. So the browser sends 4 MB chunks through
 * the app, each landing as its own small object, and the server then joins them into the finished
 * file. That is exactly what a meeting recording does, and it reuses the same two numbers and the
 * same `groupIntoParts`, because S3 will not take a part under 5 MiB: two 4 MB chunks make one part.
 *
 * **Joining is resumable and bounded**, since a function can be cut off: each part sent is recorded
 * before the next is read, so a step that dies resends at most one part, and the page drives it with
 * repeated calls while `done` is false, like `useRecordingRun`.
 *
 * Nothing here trusts the browser for anything that matters: the key is always built from an id the
 * server made, the type is the one the plan was checked against, and every call is held to the one
 * project the route already proved the caller may touch.
 */

const KEY_PREFIX = "LinkPilot/client-project-files"

type StoredUpload = IProjectFileUpload & { _id: { toString: () => string } }

/** Where one chunk of a file waits until the file is joined. */
const chunkKey = (assetId: string, index: number) => `${KEY_PREFIX}/${assetId}/parts/${index}`

/**
 * The finished file's key. The name is only ever cleaned into the key for readability in the
 * bucket; nothing is ever read back by it, and anything odd in it is dropped rather than escaped.
 */
const finalKeyFor = (assetId: string, name: string) => {
  const clean = name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file"
  return `${KEY_PREFIX}/${assetId}/${clean}`
}

const sizesOf = (upload: Pick<IProjectFileUpload, "chunks" | "chunkCount">): number[] =>
  Array.from({ length: upload.chunkCount }, (_, index) => upload.chunks?.[String(index)] ?? 0)

const arrived = (upload: Pick<IProjectFileUpload, "chunks" | "chunkCount">): boolean =>
  sizesOf(upload).every((size) => size > 0)

/**
 * One stored file read back as a page's shape. Mongoose keeps `category` as a plain string (the
 * rule that keeps these schemas flat), so it is narrowed here, and a value the app no longer knows
 * is worked out again from the content type rather than leaving the file unreadable.
 */
export const storedProjectFile = (file: {
  assetId: string
  name: string
  contentType: string
  category?: string
  size?: number
}): ProjectFile => ({
  assetId: file.assetId,
  name: file.name,
  contentType: file.contentType,
  category: (ASSET_CATEGORY_IDS as readonly string[]).includes(file.category ?? "")
    ? (file.category as ProjectFileCategory)
    : categoryForContentType(file.contentType) ?? "text",
  size: file.size ?? 0,
})

/**
 * One file with a short-lived link.
 *
 * **A video and an audio file get a plain link, so they play where they are; everything else is
 * signed as an attachment**, so it downloads by its own name rather than being rendered by the
 * browser. That is deliberate and it is the one thing standing between an accepted type and a
 * script: the list takes `image/svg+xml`, and an SVG is a document that can carry one, so no file
 * outside the two media kinds is ever opened in a tab from the bucket's own origin. The media types
 * cannot carry script, and a disposition would be ignored by `<video>` and `<audio>` anyway.
 */
export async function projectFileView(file: ProjectFile): Promise<ProjectFileView | null> {
  if (!file?.assetId || !isStorageConfigured()) return null
  const plays = file.category === "video" || file.category === "audio"
  try {
    return {
      ...file,
      url: await presignDownload(finalKeyFor(file.assetId, file.name), file.contentType, plays ? undefined : file.name),
    }
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't sign a project file link:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Forgets this project's uploads that nobody finished, with their chunks. Called before a new one
 * is planned, which is the moment that costs nothing and is bound to come round for any project
 * still in use.
 *
 * It is explicit rather than a TTL on the record **because the record is the only thing that knows
 * where the chunks are**: let it expire by itself and they stay in the bucket with nothing able to
 * name them. A failure here is logged and never stops the upload that is being planned.
 */
export async function sweepStaleProjectFileUploads(projectId: string): Promise<void> {
  try {
    const before = new Date(Date.now() - PROJECT_FILE_UPLOAD_HOURS * 60 * 60 * 1000)
    const stale = (await ProjectFileUploadModel.find({ projectId, updatedAt: { $lt: before } }).lean()) as unknown as StoredUpload[]
    if (stale.length === 0) return
    await ProjectFileUploadModel.deleteMany({ assetId: { $in: stale.map((upload) => upload.assetId) } })
    if (!isStorageConfigured()) return
    for (const upload of stale) {
      await removeChunks(upload)
      // A row with a finished object but no item naming it was abandoned between the two
      if (upload.finalKey) await deleteObject(upload.finalKey).catch(() => undefined)
    }
    console.log(`🧹 Cleared ${stale.length} unfinished project upload(s) and their chunks`)
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't clear unfinished project uploads:", error instanceof Error ? error.message : error)
  }
}

interface PlanInput {
  name: string
  contentType: string
  size: number
}

/**
 * Checks a file and says how to send it. The type decides what it is and how big it may be, through
 * Important Files' one mapping, so a type the app cannot place is a type it will not take.
 */
export async function planProjectFile(project: { id: string; ownerId: string | null }, input: PlanInput): Promise<ProjectFileUploadPlan> {
  if (!isStorageConfigured()) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileStorageUnavailable)
  const category = categoryForContentType(input.contentType)
  if (!category) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileUnsupported)
  if (input.size <= 0 || input.size > maxBytesFor(category)) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileTooLarge)

  await connectDatabase()
  // The last abandoned upload on this project goes now, chunks and all
  await sweepStaleProjectFileUploads(project.id)
  const assetId = new mongoose.Types.ObjectId().toString()
  const chunkCount = Math.max(1, Math.ceil(input.size / PROJECT_FILE_CHUNK_BYTES))
  await ProjectFileUploadModel.create({
    ownerId: project.ownerId,
    projectId: project.id,
    assetId,
    name: input.name,
    contentType: input.contentType,
    category,
    size: input.size,
    chunkBytes: PROJECT_FILE_CHUNK_BYTES,
    chunkCount,
    chunks: {},
  })
  return { assetId, chunkBytes: PROJECT_FILE_CHUNK_BYTES, chunks: chunkCount }
}

/** The upload, if it belongs to that project. Null for anything else, so a route cannot cross over. */
async function uploadOrNull(projectId: string, assetId: string): Promise<StoredUpload | null> {
  if (!/^[0-9a-f]{24}$/.test(assetId)) return null
  await connectDatabase()
  return (await ProjectFileUploadModel.findOne({ assetId, projectId }).lean()) as unknown as StoredUpload | null
}

/**
 * Takes one chunk. The index must be one this upload asked for and the bytes must fit a chunk, so
 * nothing can write outside the file it belongs to or make it longer than it said it would be.
 */
export async function storeProjectFileChunk(projectId: string, assetId: string, index: number, bytes: Buffer): Promise<{ received: number }> {
  const upload = await uploadOrNull(projectId, assetId)
  if (!upload) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileNotFound)
  if (!Number.isInteger(index) || index < 0 || index >= upload.chunkCount) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileChunkFailed)
  if (bytes.length === 0 || bytes.length > upload.chunkBytes) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileChunkFailed)
  if (upload.finalKey) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileChunkFailed)

  await putObject(chunkKey(assetId, index), bytes, upload.contentType)
  // The same chunk twice lands on the same key and records the same size, so a retry is harmless
  const saved = await ProjectFileUploadModel.findOneAndUpdate(
    { assetId, projectId },
    { $set: { [`chunks.${index}`]: bytes.length } },
    { returnDocument: "after" }
  ).lean() as unknown as StoredUpload | null
  // Deleted while the chunk was in the air: take the chunk back out rather than leave it paying rent
  if (!saved) {
    await deleteObject(chunkKey(assetId, index)).catch(() => undefined)
    throw new UserFacingError(PROJECT_TASK_MESSAGES.fileNotFound)
  }
  return { received: sizesOf(saved).filter((size) => size > 0).length }
}

/** Removes the chunks of an upload, which is everything it left behind before it was joined. */
async function removeChunks(upload: Pick<IProjectFileUpload, "assetId" | "chunkCount">): Promise<void> {
  for (let index = 0; index < upload.chunkCount; index++) {
    await deleteObject(chunkKey(upload.assetId, index)).catch(() => undefined)
  }
}

/**
 * Joins what has arrived into the finished file, as far as it can before `deadline`, and answers
 * where it got to. The page calls it again while `done` is false.
 *
 * One chunk is a single `putObject`; more than one is a multipart upload whose parts are runs of
 * chunks at least 5 MiB long, S3's own minimum. Each part is recorded before the next is read, so a
 * step cut off mid-flight resends one part rather than starting again.
 */
export async function finishProjectFile(projectId: string, assetId: string, deadline: number): Promise<ProjectFileProgress> {
  const upload = await uploadOrNull(projectId, assetId)
  if (!upload) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileNotFound)
  const sizes = sizesOf(upload)
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0)
  const file: ProjectFile = {
    assetId: upload.assetId,
    name: upload.name,
    contentType: upload.contentType,
    category: upload.category as ProjectFileCategory,
    size: totalBytes,
  }
  const finished = async (): Promise<ProjectFileProgress> => {
    await removeChunks(upload)
    await ProjectFileUploadModel.deleteOne({ assetId, projectId })
    const view = await projectFileView(file)
    if (!view) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileUploadFailed)
    return { done: true, file: view, joinedBytes: totalBytes, totalBytes }
  }

  if (upload.finalKey) return finished()
  if (!arrived(upload)) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileChunkFailed)

  const finalKey = finalKeyFor(assetId, upload.name)
  const set = (changes: Partial<IProjectFileUpload>) => ProjectFileUploadModel.updateOne({ assetId, projectId }, { $set: changes })

  const readPart = async (part: { from: number; to: number }): Promise<Buffer> => {
    const pieces: Buffer[] = []
    for (let index = part.from; index < part.to; index++) {
      const bytes = await getObjectBytes(chunkKey(assetId, index))
      if (!bytes) throw new UserFacingError(PROJECT_TASK_MESSAGES.fileChunkFailed)
      pieces.push(bytes)
    }
    return Buffer.concat(pieces)
  }

  const parts = groupIntoParts(sizes, PROJECT_FILE_PART_BYTES)
  if (parts.length <= 1) {
    await putObject(finalKey, await readPart({ from: 0, to: upload.chunkCount }), upload.contentType)
    await set({ finalKey })
    return finished()
  }

  const uploadId = upload.uploadId ?? (await startMultipartUpload(finalKey, upload.contentType))
  if (!upload.uploadId) await set({ uploadId, nextPart: 1 })
  let joinedBytes = parts.slice(0, Math.max(0, upload.nextPart - 1)).reduce((sum, part) => sum + part.bytes, 0)
  for (let partNumber = upload.nextPart; partNumber <= parts.length; partNumber++) {
    if (Date.now() > deadline) return { done: false, file: null, joinedBytes, totalBytes }
    try {
      await uploadPartBytes(finalKey, uploadId, partNumber, await readPart(parts[partNumber - 1]))
    } catch (error: unknown) {
      await abortMultipartUpload(finalKey, uploadId).catch(() => undefined)
      await set({ uploadId: null, nextPart: 1 })
      throw error
    }
    joinedBytes += parts[partNumber - 1].bytes
    await set({ nextPart: partNumber + 1 })
  }
  await completeMultipartUpload(finalKey, uploadId)
  await set({ finalKey })
  return finished()
}

/**
 * Removes the stored files of items that have gone. A file is an attachment, so the records go
 * first and a storage failure is logged rather than failing the delete the user asked for.
 */
export async function deleteProjectFiles(files: readonly (ProjectFile | null | undefined)[]): Promise<void> {
  if (!isStorageConfigured()) return
  for (const file of files) {
    if (!file?.assetId) continue
    try {
      await deleteObject(finalKeyFor(file.assetId, file.name))
    } catch (error: unknown) {
      console.warn("⚠️ Couldn't remove a project file:", error instanceof Error ? error.message : error)
    }
  }
}

/**
 * Forgets the uploads of projects that have gone, with any chunks they had taken. Called when a
 * project, a client or an account goes, so nothing is left paying rent for a file nobody finished.
 */
export async function deleteProjectFileUploads(scope: Record<string, unknown>, projectIds: readonly string[]): Promise<void> {
  if (projectIds.length === 0) return
  await connectDatabase()
  const uploads = (await ProjectFileUploadModel.find({ ...scope, projectId: { $in: [...projectIds] } }).lean()) as unknown as StoredUpload[]
  if (uploads.length === 0) return
  await ProjectFileUploadModel.deleteMany({ assetId: { $in: uploads.map((upload) => upload.assetId) } })
  if (!isStorageConfigured()) return
  for (const upload of uploads) {
    await removeChunks(upload)
    if (upload.finalKey) await deleteObject(upload.finalKey).catch(() => undefined)
  }
}
