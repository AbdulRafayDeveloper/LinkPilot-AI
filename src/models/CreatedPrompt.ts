import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * Every prompt the Prompt Creator wrote: the request it came from, the target it was shaped
 * for, the name the model gave it and the prompt itself, with the user's later edits.
 */
export interface ICreatedPrompt {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  prompt: string
  target: string
  request: string
  requestSource: "text" | "voice"
  /**
   * The description read back in clear, simple English, when the user asked for it before creating
   * the prompt. Empty for every prompt written without it, which is how all of them read before
   * this and how an English description reads when nothing had to be converted.
   */
  englishRequest: string
  // The folder it is filed in (models/PromptFolder.ts), null for a prompt in no folder
  folderId: string | null
  // The client project it was written for (models/ClientProject.ts), null for one written outside any
  projectId: string | null
  provider: string
  // When the user last changed the name or the prompt by hand
  editedAt: Date | null
  // When the user marked the prompt as one they have used, or null while it is unused
  appliedAt: Date | null
  // The prompts this one waits for (ids of other created prompts), in the order to work in. Empty
  // for a prompt that waits for nothing, which is how every prompt saved before this reads
  dependencyIds: string[]
  createdAt: Date
  updatedAt: Date
}

const CreatedPromptSchema = new Schema<ICreatedPrompt>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    prompt: { type: String, required: true },
    target: { type: String, required: true, index: true },
    request: { type: String, required: true },
    requestSource: { type: String, enum: ["text", "voice"], required: true },
    englishRequest: { type: String, default: "" },
    folderId: { type: String, default: null, index: true },
    projectId: { type: String, default: null, index: true },
    provider: { type: String, default: null },
    editedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
    dependencyIds: { type: [String], default: [] },
  },
  { timestamps: true, collection: "created_prompts" }
)
CreatedPromptSchema.index({ createdAt: -1 })
// Which prompts are blocked is asked of this field on every page of the history
CreatedPromptSchema.index({ dependencyIds: 1 })

export const CreatedPromptModel =
  (mongoose.models.CreatedPrompt as Model<ICreatedPrompt> | undefined) ??
  mongoose.model<ICreatedPrompt>("CreatedPrompt", CreatedPromptSchema)
