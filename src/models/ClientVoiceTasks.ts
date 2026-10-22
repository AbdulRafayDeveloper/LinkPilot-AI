import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * **One batch of voice messages**, which is the record the module is built around: when it was run,
 * whose it was, the work it asked for, the questions it asked, and which voices could not be read.
 *
 * It is written as the run **starts**, so every voice has a batch to belong to and a task step that
 * fails still leaves the recordings and the transcripts kept rather than orphaned; the lists are
 * written onto it when they are ready. The collection is still `client_voice_tasks` and a voice
 * still points at it with `taskGroupId`, because every batch and voice already saved carries those
 * names: this is a rename of what is read, not of what is stored (see Personal Drive).
 */
export interface IClientVoiceTask {
  task: string
  // Which voices in the batch asked for it (Voice 1, Voice 2...)
  voices: number[]
}

/** One thing the client asked about. A question is answered, never done, so it is kept apart. */
export interface IClientVoiceQuestion {
  question: string
  voices: number[]
}

export interface IClientVoiceTasks {
  ownerId: string | null
  // The client the batch was run under, "" for none
  clientId: string
  clientName: string
  tasks: IClientVoiceTask[]
  questions: IClientVoiceQuestion[]
  // How many voices went into the batch, however many could be written out
  voiceCount: number
  // The voices this list was made from
  voiceIds: string[]
  // Voices that could not be written out, so the lists were made without them
  missingVoices: number[]
  // Which provider wrote the lists, and every provider that answered (types/ai.ts)
  provider: string | null
  providers: string[]
  editedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const TaskSchema = new Schema<IClientVoiceTask>(
  { task: { type: String, required: true }, voices: { type: [Number], default: [] } },
  { _id: false }
)

const QuestionSchema = new Schema<IClientVoiceQuestion>(
  { question: { type: String, required: true }, voices: { type: [Number], default: [] } },
  { _id: false }
)

const ClientVoiceTasksSchema = new Schema<IClientVoiceTasks>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, default: "" },
    clientName: { type: String, default: "" },
    tasks: { type: [TaskSchema], default: [] },
    questions: { type: [QuestionSchema], default: [] },
    voiceCount: { type: Number, default: 0 },
    voiceIds: { type: [String], default: [] },
    missingVoices: { type: [Number], default: [] },
    provider: { type: String, default: null },
    providers: { type: [String], default: [] },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "client_voice_tasks" }
)
ClientVoiceTasksSchema.index({ clientId: 1, createdAt: -1, _id: -1 })
// The "view all" page: every batch, newest first, with the id to settle a tie
ClientVoiceTasksSchema.index({ createdAt: -1, _id: -1 })

export const ClientVoiceTasksModel =
  (mongoose.models.ClientVoiceTasks as Model<IClientVoiceTasks> | undefined) ??
  mongoose.model<IClientVoiceTasks>("ClientVoiceTasks", ClientVoiceTasksSchema)
