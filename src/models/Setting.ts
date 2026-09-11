import mongoose, { Schema, type Model, type Document as MongooseDocument } from "mongoose"

export interface ISetting extends MongooseDocument {
  key: string
  value: string
  createdAt: Date
  updatedAt: Date
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

export const Setting =
  (mongoose.models.Setting as Model<ISetting> | undefined) ?? mongoose.model<ISetting>("Setting", SettingSchema)
