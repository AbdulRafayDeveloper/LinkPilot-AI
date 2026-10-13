import { connectDatabase } from "@/lib/db"
import { Meeting as MeetingModel, type IMeeting } from "@/models/Meeting"
import { meetingLinkMatches, meetingLinkToken, readMeetingLinkToken } from "@/lib/meetingLink"
import { linksForRecording } from "@/services/meetings/recording"
import { visibleById } from "@/services/auth/viewer"
import type { MeetingAnalysis, PublicMeeting } from "@/types/meetings"
import type { MeetingRecordingLinks, StoredRecording } from "@/types/meetingRecording"
import type { Viewer } from "@/types/auth"

/**
 * The link one meeting can be shared by: what it opens, and the owner's control over it.
 *
 * **Read only, on purpose.** The whole point of this link is to hand someone a recording to watch
 * and the summary that came out of it, so there is no write of any kind here, no chat, and nothing
 * the receiver could change. That is what makes it different from a client project's link, which
 * exists so the client can add to the work.
 */

type StoredMeeting = IMeeting & { _id: { toString: () => string } }

/** Only the fields the shared page shows, so a transcript is never read to serve it. */
const PUBLIC_FIELDS = {
  title: 1,
  createdAt: 1,
  notes: 1,
  analysis: 1,
  recording: 1,
  publicLinkVersion: 1,
  publicLinkActive: 1,
} as const

/** The token of the link that is on, or null when the meeting has none. */
export const publicMeetingToken = (meeting: { publicLinkActive?: boolean; publicLinkVersion?: number }, id: string) =>
  meeting.publicLinkActive ? meetingLinkToken(id, meeting.publicLinkVersion ?? 0) : null

/**
 * Makes a meeting's share link, replaces it, or turns it off. **replace** raises the version, which
 * stops every link already sent at once; **disable** stops them all and turning it on again gives a
 * link nobody has seen. Nothing but a version and a flag is stored, so the link itself is never kept.
 */
export async function changeMeetingLink(viewer: Viewer, id: string, action: "create" | "replace" | "disable"): Promise<{ publicToken: string | null } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const current = (await MeetingModel.findOne(filter, { publicLinkVersion: 1 }).lean()) as unknown as StoredMeeting | null
  if (!current) return null
  const version = (current.publicLinkVersion ?? 0) + (action === "replace" ? 1 : 0)
  const changes = { publicLinkVersion: version, publicLinkActive: action !== "disable" }
  await MeetingModel.updateOne(filter, { $set: changes })
  return { publicToken: publicMeetingToken(changes, id) }
}

/**
 * The one meeting a token opens, or null for a token that doesn't name a meeting, doesn't match
 * that meeting's current version, or names a meeting whose link is off, so every refusal reads the
 * same whatever went wrong.
 *
 * **This is the only door the link has**, exactly as `projectFromToken` is for a project: both the
 * meeting and its recording links go through it, so turning the link off stops the video in the
 * same breath as the page.
 */
export async function meetingFromToken(token: string): Promise<StoredMeeting | null> {
  const read = readMeetingLinkToken(token)
  if (!read) return null
  await connectDatabase()
  const record = (await MeetingModel.findById(read.meetingId, PUBLIC_FIELDS).lean()) as unknown as StoredMeeting | null
  if (!record?.publicLinkActive || !meetingLinkMatches(read, record.publicLinkVersion ?? 0)) return null
  return record
}

/**
 * What a shared link shows: the recording's own details, the summary, the notes and the analysis.
 *
 * It is deliberately less than the owner's page: **no transcript** (the video holds everything it
 * would say), no chat, and nothing that names the account, the client or any id.
 */
export async function readPublicMeeting(token: string): Promise<PublicMeeting | null> {
  const record = await meetingFromToken(token)
  if (!record) return null
  const recording = record.recording as StoredRecording | null
  const analysis = (record.analysis as MeetingAnalysis | null) ?? null
  return {
    title: record.title,
    createdAt: new Date(record.createdAt).toISOString(),
    durationMs: recording?.durationMs ?? null,
    hasVideo: Boolean(recording?.tracks?.screen?.finalKey),
    minutes: analysis?.minutes ?? "",
    notes: record.notes ?? "",
    analysis,
  }
}

/**
 * Signed links to play and download the shared meeting's recording, or null when the token opens
 * nothing and `{ screen: null }` when that meeting has no joined video. They expire like every
 * other link to a stored file here, so the bucket stays private.
 */
export async function publicRecordingLinks(token: string): Promise<MeetingRecordingLinks | null> {
  const record = await meetingFromToken(token)
  if (!record) return null
  const recording = record.recording as StoredRecording | null
  if (!recording) return { screen: null, camera: null, audio: [] }
  return linksForRecording(record._id.toString(), record.title, recording)
}
