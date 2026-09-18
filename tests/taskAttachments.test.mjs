import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { TaskDetailsSchema, TaskImageSchema, TaskImageUploadSchema } = load("lib/validation/taskAttachment.ts")
const { TASK_DESCRIPTION_MAX_LENGTH, TASK_IMAGE_MAX_BYTES, TASK_IMAGE_TYPES } = load("constants/taskAttachments.ts")
const { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES } = load("constants/postInput.ts")
const { emptyTaskDetails, hasTaskDetails } = load("types/taskAttachment.ts")

const ASSET = "6aac46349c1019d7aa40b7c0"

test("a task with nothing extra is still a task", () => {
  const plain = TaskDetailsSchema.parse({})
  assert.equal(plain.description, "")
  assert.equal(plain.image, null)
  assert.deepEqual(TaskDetailsSchema.parse({ description: "   ", image: null }), { description: "", image: null })
})

test("a description is kept as typed, trimmed at the ends, and has a ceiling", () => {
  assert.equal(TaskDetailsSchema.parse({ description: "  call the supplier\n\nthen invoice  " }).description, "call the supplier\n\nthen invoice")
  assert.equal(TaskDetailsSchema.safeParse({ description: "x".repeat(TASK_DESCRIPTION_MAX_LENGTH) }).success, true)
  assert.equal(TaskDetailsSchema.safeParse({ description: "x".repeat(TASK_DESCRIPTION_MAX_LENGTH + 1) }).success, false)
})

test("only an id the server issued and a type it accepts can be saved as an image", () => {
  assert.deepEqual(TaskImageSchema.parse({ assetId: ASSET, contentType: "image/png" }), { assetId: ASSET, contentType: "image/png" })
  // Nothing the browser sends may stand in for the id, so a key or a path is refused outright
  for (const bad of ["../../etc/passwd", "LinkPilot/task-images/x.png", "", "not-an-id", `${ASSET}x`]) {
    assert.equal(TaskImageSchema.safeParse({ assetId: bad, contentType: "image/png" }).success, false, `${bad} is not an id`)
  }
  assert.equal(TaskImageSchema.safeParse({ assetId: ASSET, contentType: "image/svg+xml" }).success, false, "an svg is not an image type here")
  assert.equal(TaskImageSchema.safeParse({ assetId: ASSET, contentType: "text/html" }).success, false)
})

test("the picker in the browser and the server agree about what an image may be", () => {
  // The shared ImageDropzone checks a file against the post limits before it leaves the browser,
  // so a task image held to anything else would be accepted there and refused here
  assert.deepEqual([...TASK_IMAGE_TYPES], [...POST_IMAGE_TYPES])
  assert.equal(TASK_IMAGE_MAX_BYTES, POST_IMAGE_MAX_BYTES)
})

test("an upload is only planned for a size and type that will be accepted", () => {
  assert.equal(TaskImageUploadSchema.safeParse({ contentType: "image/png", size: 1024 }).success, true)
  assert.equal(TaskImageUploadSchema.safeParse({ contentType: "image/png", size: TASK_IMAGE_MAX_BYTES }).success, true)
  assert.equal(TaskImageUploadSchema.safeParse({ contentType: "image/png", size: TASK_IMAGE_MAX_BYTES + 1 }).success, false)
  assert.equal(TaskImageUploadSchema.safeParse({ contentType: "image/png", size: 0 }).success, false)
  assert.equal(TaskImageUploadSchema.safeParse({ contentType: "application/pdf", size: 1024 }).success, false)
})

test("a details area nobody opened costs the task nothing", () => {
  const empty = emptyTaskDetails()
  assert.equal(hasTaskDetails(empty), false)
  assert.equal(hasTaskDetails({ ...empty, description: "   " }), false, "spaces alone are not a description")
  assert.equal(hasTaskDetails({ ...empty, description: "why it matters" }), true)
  assert.equal(hasTaskDetails({ ...empty, image: { assetId: ASSET, contentType: "image/png" } }), true)
  // A file still going up counts, so a task is never saved while its image is in flight
  assert.equal(hasTaskDetails({ ...empty, file: { name: "shot.png" } }), true)
})
