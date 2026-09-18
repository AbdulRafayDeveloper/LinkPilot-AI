import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * The work one batch of a client's voices asked for: the list as it was written, and as the user
 * edited it afterwards. It points at the voices it was made from, so a saved voice can always show
 * the tasks it belongs to.
 */
export interface IClientVoiceTask {
  task: string
  // Which voices in the batch asked for it (Voice 1, Voice 2...)
  voices: number[]
}

export interface IClientVoiceTasks {
  ownerId: string | null
  clientId: string
  clientName: string
  tasks: IClientVoiceTask[]
  // The voices this list was made from
  voiceIds: string[]
  // Voices that could not be written out, so the list was made without them
  missingVoices: number[]
  editedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const TaskSchema = new Schema<IClientVoiceTask>(
  { task: { type: String, required: true }, voices: { type: [Number], default: [] } },
  { _id: false }
)

const ClientVoiceTasksSchema = new Schema<IClientVoiceTasks>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, required: true },
    clientName: { type: String, default: "" },
    tasks: { type: [TaskSchema], default: [] },
    voiceIds: { type: [String], default: [] },
    missingVoices: { type: [Number], default: [] },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "client_voice_tasks" }
)
ClientVoiceTasksSchema.index({ clientId: 1, createdAt: -1, _id: -1 })

export const ClientVoiceTasksModel =
  (mongoose.models.ClientVoiceTasks as Model<IClientVoiceTasks> | undefined) ??
  mongoose.model<IClientVoiceTasks>("ClientVoiceTasks", ClientVoiceTasksSchema)
