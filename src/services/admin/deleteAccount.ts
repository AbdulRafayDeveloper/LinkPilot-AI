import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { AssetFile } from "@/models/AssetFile"
import { Meeting } from "@/models/Meeting"
import { MeetingChunk } from "@/models/MeetingChunk"
import { PostImageModel } from "@/models/PostImage"
import { UserModel } from "@/models/User"
import { ADMIN_MESSAGES } from "@/constants/admin"
import { abortMultipartUpload, deleteObject, isStorageConfigured } from "@/services/storage/s3"
import { removeRecordingFiles } from "@/services/meetings/recording"
import { recordLoginEvent, type ClientInfo } from "@/services/auth/audit"
import type { Viewer } from "@/types/auth"
import type { AccountDeletion } from "@/types/admin"
import { SOURCES, titleOf } from "./activity"

/**
 * Deleting an account and everything it made, for an admin.
 *
 * "Everything" is the list activity already counts from (every collection whose records carry the
 * account's `ownerId`), plus what hangs off those records without an owner of its own: the parts of
 * each meeting that were read (`meeting_chunks`) and the files kept in S3 behind Important Files and
 * the Post Image Creator. The sign-in history stays in Audit Management, as the record that the
 * account existed and who deleted it.
 *
 * The order is what makes a failure safe to retry: nothing is deleted until every check passes, the
 * stored files go before any record (so a storage failure leaves the account whole), and the
 * account itself goes last (so an interrupted delete still shows the account, and running it again
 * finishes the job).
 */

// Files removed from storage at once; enough to be quick, few enough not to be throttled
const STORAGE_CONCURRENCY = 5

interface StoredFile {
  storageKey: string
  uploadId?: string | null
}

async function removeStoredFiles(files: StoredFile[]): Promise<void> {
  const queue = [...files]
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      // An upload that never finished holds its parts until it is aborted; a key already gone is fine
      if (file.uploadId) await abortMultipartUpload(file.storageKey, file.uploadId).catch(() => undefined)
      await deleteObject(file.storageKey)
    }
  }
  await Promise.all(Array.from({ length: Math.min(STORAGE_CONCURRENCY, files.length) }, worker))
}

export async function deleteAccount(admin: Viewer, id: string, confirmEmail: string, client: ClientInfo): Promise<AccountDeletion | null> {
  if (!/^[0-9a-f]{24}$/.test(id)) return null
  await connectDatabase()
  const account = await UserModel.findById(id, { name: 1, email: 1, role: 1 }).lean()
  if (!account) return null

  // Every check before anything is removed
  if (String(account._id) === admin.id) throw new UserFacingError(ADMIN_MESSAGES.cannotDeleteSelf)
  if (confirmEmail.trim().toLowerCase() !== account.email.toLowerCase()) throw new UserFacingError(ADMIN_MESSAGES.confirmEmailMismatch)
  if (account.role === "admin" && (await UserModel.countDocuments({ role: "admin" })) <= 1) {
    throw new UserFacingError(ADMIN_MESSAGES.cannotDeleteLastAdmin)
  }

  const owner = { ownerId: id }
  const [assetFiles, postImages] = await Promise.all([
    AssetFile.find(owner, { storageKey: 1, uploadId: 1 }).lean(),
    PostImageModel.find(owner, { storageKey: 1 }).lean(),
  ])
  const files: StoredFile[] = [...assetFiles, ...postImages].filter((file) => Boolean(file.storageKey))
  if (files.length > 0 && !isStorageConfigured()) throw new UserFacingError(ADMIN_MESSAGES.storageUnavailable)

  // 1. Stored files. If storage fails here, no record has been touched yet
  await removeStoredFiles(files)
  // Meeting recordings are attachments of their meetings: removed here too, and a failure is only logged
  const recorded = (await Meeting.find({ ...owner, recording: { $ne: null } }, { _id: 1, recording: 1 }).lean()) as unknown as { _id: unknown; recording: unknown }[]
  await Promise.all(recorded.map((meeting) => removeRecordingFiles(String(meeting._id), meeting.recording)))

  // 2. What hangs off a record without an owner of its own
  const meetingIds = (await Meeting.find(owner, { _id: 1 }).lean()).map((meeting) => meeting._id)
  if (meetingIds.length > 0) await MeetingChunk.deleteMany({ meetingId: { $in: meetingIds } })

  // 3. Every record the account owns, in every tool
  const counts = await Promise.all(
    SOURCES.map(async (source) => ({ title: titleOf(source), count: (await source.collection().deleteMany(owner)).deletedCount }))
  )

  // 4. The account itself, last; its sessions stop working at once, because a session is checked against it
  await UserModel.deleteOne({ _id: id })

  await recordLoginEvent("account-deleted", { userId: id, email: account.email, name: account.name }, client, admin.email)

  const tools = counts.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count)
  const deletion: AccountDeletion = {
    name: account.name,
    email: account.email,
    records: tools.reduce((sum, entry) => sum + entry.count, 0),
    files: files.length,
    tools,
  }
  console.info("Account deleted:", JSON.stringify({ id, by: admin.id, records: deletion.records, files: deletion.files }))
  return deletion
}
