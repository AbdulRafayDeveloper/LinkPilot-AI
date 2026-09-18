import mongoose, { Schema, type Model } from "mongoose"

/**
 * Which of a provider's keys is answering now, and which are resting after a refusal, shared by every
 * server instance (services/groqKeyState.ts). One document per provider; it belongs to no account.
 *
 * A key is named by a short SHA-256 fingerprint, never by its value or its number: the value is a
 * secret, and a number moves when a key is added or removed where the app runs.
 */
export interface IProviderKeyState {
  provider: string
  // The fingerprint of the key that answered last, which every call starts from
  activeKey: string | null
  // Fingerprint to the time (ms) the key may be tried ahead of the others again
  rests: Map<string, number>
  createdAt: Date
  updatedAt: Date
}

const ProviderKeyStateSchema = new Schema<IProviderKeyState>(
  {
    provider: { type: String, required: true, unique: true },
    activeKey: { type: String, default: null },
    rests: { type: Map, of: Number, default: {} },
  },
  { timestamps: true, collection: "provider_key_states" }
)

export const ProviderKeyStateModel =
  (mongoose.models.ProviderKeyState as Model<IProviderKeyState> | undefined) ??
  mongoose.model<IProviderKeyState>("ProviderKeyState", ProviderKeyStateSchema)
