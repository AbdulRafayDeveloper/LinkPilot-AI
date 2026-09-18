import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One voice message kept for a client: the recording itself lives in S3 (`storageKey`), and this is
 * what the app knows about it, including the transcript it was written out as. A voice is only kept
 * when a client was chosen for the batch; without a client nothing is stored, as before.
 */
export interface IClientVoice {
  ownerId: string | null
  clientId: string
  // The client's name as it was when the voice was saved, so a renamed client still reads sensibly
  clientName: string
  // Where it sat in the batch it arrived with (Voice 1, Voice 2...)
  position: number
  name: string
  size: number
  contentType: string
  storageKey: string
  transcript: string
  // Which provider wrote it out
  transcribedBy: string | null
  // The task list this voice was part of, when one was made
  taskGroupId: string | null
  createdAt: Date
  updatedAt: Date
}

const ClientVoiceSchema = new Schema<IClientVoice>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, required: true },
    clientName: { type: String, default: "" },
    position: { type: Number, default: 1 },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    contentType: { type: String, required: true },
    storageKey: { type: String, required: true },
    transcript: { type: String, default: "" },
    transcribedBy: { type: String, default: null },
    taskGroupId: { type: String, default: null },
  },
  { timestamps: true, collection: "client_voices" }
)
// The list is one client's voices, or everyone's, newest first
ClientVoiceSchema.index({ clientId: 1, createdAt: -1, _id: -1 })
ClientVoiceSchema.index({ createdAt: -1, _id: -1 })

export const ClientVoiceModel =
  (mongoose.models.ClientVoice as Model<IClientVoice> | undefined) ?? mongoose.model<IClientVoice>("ClientVoice", ClientVoiceSchema)
