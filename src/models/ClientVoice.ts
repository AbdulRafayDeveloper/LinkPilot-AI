import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One kept voice message: the recording itself lives in S3 (`storageKey`), and this is what the app
 * knows about it, including the transcript it was written out as. **Every voice of every batch is
 * kept**, with or without a client, so a recording is never lost; `clientId` is simply empty when
 * the batch was not run under a client.
 *
 * `taskGroupId` is the **batch** it arrived in, and is read as `batchId` everywhere above this file.
 * The stored name is kept because every voice already saved carries it, the way Personal Drive kept
 * `important_files`: renaming the field would cost a migration and buy nothing.
 */
export interface IClientVoice {
  ownerId: string | null
  // The client the batch was run under, "" when it was run under none
  clientId: string
  // The client's name as it was when the voice was saved, so a renamed client still reads sensibly
  clientName: string
  // Where it sat in the batch it arrived with (Voice 1, Voice 2...)
  position: number
  name: string
  size: number
  contentType: string
  // Where the recording is in the bucket, "" when there was no file storage to keep it in
  storageKey: string
  transcript: string
  // The same voice in clear points, written when the batch's lists were
  clearPoints: string[]
  // Which provider wrote it out
  transcribedBy: string | null
  // How long the recording runs, measured by the browser; 0 on one kept before it was measured
  durationSeconds: number
  // The batch this voice arrived in
  taskGroupId: string | null
  createdAt: Date
  updatedAt: Date
}

const ClientVoiceSchema = new Schema<IClientVoice>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, default: "" },
    clientName: { type: String, default: "" },
    position: { type: Number, default: 1 },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    contentType: { type: String, required: true },
    storageKey: { type: String, default: "" },
    transcript: { type: String, default: "" },
    clearPoints: { type: [String], default: [] },
    transcribedBy: { type: String, default: null },
    durationSeconds: { type: Number, default: 0 },
    taskGroupId: { type: String, default: null },
  },
  { timestamps: true, collection: "client_voices" }
)
// The list is one client's voices, or everyone's, newest first
ClientVoiceSchema.index({ clientId: 1, createdAt: -1, _id: -1 })
ClientVoiceSchema.index({ createdAt: -1, _id: -1 })
// One batch's own voices, in the order they arrived, which is what its page reads
ClientVoiceSchema.index({ taskGroupId: 1, position: 1 })

export const ClientVoiceModel =
  (mongoose.models.ClientVoice as Model<IClientVoice> | undefined) ?? mongoose.model<IClientVoice>("ClientVoice", ClientVoiceSchema)
