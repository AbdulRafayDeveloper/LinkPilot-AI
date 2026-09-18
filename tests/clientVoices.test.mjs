import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { TranscriptBatchSchema, EditTasksSchema } = load("lib/validation/clientVoices.ts")
const { ClientVoiceModel } = load("models/ClientVoice.ts")
const { ClientVoiceTasksModel } = load("models/ClientVoiceTasks.ts")

// What a batch sends when no client is chosen: the transcripts alone, and nothing is kept
test("a batch with no client is still valid, and carries no client or voice ids", () => {
  const parsed = TranscriptBatchSchema.parse({
    voices: [{ voice: 1, transcript: "Please change the logo colour." }],
    missingVoices: [2],
  })
  assert.equal(parsed.clientId, undefined)
  assert.deepEqual(parsed.missingVoices, [2])
})

test("a batch with a client carries the client and the voices that were kept", () => {
  const parsed = TranscriptBatchSchema.parse({
    voices: [{ voice: 1, transcript: "Send the invoice today." }],
    clientId: "652f1c0e9a4b2d3f5a6c7e81",
    voiceIds: ["652f1c0e9a4b2d3f5a6c7e82", "652f1c0e9a4b2d3f5a6c7e83"],
  })
  assert.equal(parsed.clientId, "652f1c0e9a4b2d3f5a6c7e81")
  assert.equal(parsed.voiceIds?.length, 2)
})

test("an edited task list needs real wording, so a blank line can never replace a task", () => {
  assert.deepEqual(
    EditTasksSchema.parse({ tasks: [{ task: "Change the logo colour", voices: [1, 2] }] }).tasks[0].voices,
    [1, 2]
  )
  assert.throws(() => EditTasksSchema.parse({ tasks: [{ task: "   ", voices: [] }] }))
})

test("a kept voice belongs to an account and a client, and knows where its recording is", () => {
  const voice = new ClientVoiceModel({
    ownerId: "account",
    clientId: "652f1c0e9a4b2d3f5a6c7e81",
    clientName: "Acme",
    position: 1,
    name: "voice-1.ogg",
    size: 12345,
    contentType: "audio/ogg",
    storageKey: "LinkPilot/client-voices/abc-voice-1.ogg",
    transcript: "Please send the invoice.",
  })
  assert.ok(voice._id)
  assert.equal(voice.ownerId, "account")
  assert.equal(voice.taskGroupId, null)
  assert.equal(voice.storageKey, "LinkPilot/client-voices/abc-voice-1.ogg")
})

test("a saved task list keeps the voices it was made from and the ones it was made without", () => {
  const group = new ClientVoiceTasksModel({
    ownerId: "account",
    clientId: "652f1c0e9a4b2d3f5a6c7e81",
    clientName: "Acme",
    tasks: [{ task: "Send the invoice", voices: [1] }],
    voiceIds: ["652f1c0e9a4b2d3f5a6c7e82"],
    missingVoices: [2],
  })
  assert.ok(group._id)
  assert.equal(group.tasks[0].task, "Send the invoice")
  assert.deepEqual(group.missingVoices, [2])
  assert.equal(group.editedAt, null)
})

// The record and its recording are made together: a record with no key would point at nothing, so
// the key is built from the id before anything is written
test("a kept voice cannot be written without the key of its recording", () => {
  const missing = new ClientVoiceModel({
    ownerId: "account",
    clientId: "652f1c0e9a4b2d3f5a6c7e81",
    name: "voice-1.ogg",
    contentType: "audio/ogg",
  }).validateSync()
  assert.ok(missing?.errors?.storageKey, "a voice with no storage key passed validation")
})
