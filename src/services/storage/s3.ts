import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "@/config/env"
import { UserFacingError } from "@/lib/errors"
import { IMPORTANT_FILES_MESSAGES, SIGNED_URL_TTL_SECONDS } from "@/constants/importantFiles"

/**
 * The app's file storage: one private S3 bucket, everything under the app's own LinkPilot
 * folder (Important Files and Post Image Creator each have their own prefix inside it). This module is
 * the only place the AWS credentials are read, and they never leave the server. Nothing the
 * browser receives is more than a signed link that stops working on its own.
 *
 * The browser sends the bytes to S3 itself, with a link signed here, so a 500 MB video never
 * passes through a serverless request. Large files go up in parts, and the finished object is
 * assembled by S3 only once every part has landed.
 */

// Attempts per S3 call, the first one included
const STORAGE_MAX_ATTEMPTS = 3

// Everything this app stores lives under one folder in the bucket, away from anything else in it
const KEY_PREFIX = "LinkPilot/important-files"

let client: S3Client | null = null

/** True when all four AWS variables are set, so the module can say so instead of failing oddly. */
export function isStorageConfigured(): boolean {
  return Boolean(env.AWS_REGION && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET_NAME)
}

function bucket(): string {
  if (!isStorageConfigured()) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.storageUnavailable)
  return env.AWS_S3_BUCKET_NAME as string
}

function s3(): S3Client {
  if (!isStorageConfigured()) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.storageUnavailable)
  client ??= new S3Client({
    region: env.AWS_REGION as string,
    // Every S3 call retries on its own: throttling, 5xx and dropped connections, with backoff and
    // jitter (the SDK's standard mode), so nothing in this module needs a retry loop of its own
    maxAttempts: STORAGE_MAX_ATTEMPTS,
    retryMode: "standard",
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  })
  return client
}

/**
 * The object key for a new file. The server builds every key from the record's own id plus a
 * cleaned file name, so nothing the browser sends can point the upload at another key, walk out
 * of the prefix, or overwrite an existing object.
 */
export function buildStorageKey(assetId: string, originalName: string): string {
  const safeName =
    originalName
      .split(/[\\/]/)
      .pop()!
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "file"
  return `${KEY_PREFIX}/${assetId}/${safeName}`
}

/**
 * Stores bytes the server itself made, such as a generated image. Everything the browser sends
 * goes through a signed link instead, so this is only for what never passes through the browser.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }))
}

/** A link the browser can PUT one whole small file to. The type is pinned into the signature. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  })
}

/** Starts a multipart upload and returns its id, which every part and the finish refer to. */
export async function startMultipartUpload(key: string, contentType: string): Promise<string> {
  const { UploadId } = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType })
  )
  if (!UploadId) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.uploadFailed)
  return UploadId
}

/** One link per part, all signed in one go, so the browser can send them without asking again. */
export function presignParts(key: string, uploadId: string, partCount: number): Promise<{ partNumber: number; url: string }[]> {
  return Promise.all(
    Array.from({ length: partCount }, async (_unused, index) => {
      const partNumber = index + 1
      const url = await getSignedUrl(
        s3(),
        new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
        { expiresIn: SIGNED_URL_TTL_SECONDS }
      )
      return { partNumber, url }
    })
  )
}

/**
 * Sends one part of a multipart upload from the server, for bytes the server assembled itself (the
 * chunks of a meeting recording joined into parts S3 accepts). The browser's own parts go through
 * signed links instead.
 */
export async function uploadPartBytes(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<void> {
  await s3().send(new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }))
}

/**
 * Assembles the parts into the finished object. The part list comes from S3 itself rather than
 * from the browser, so a page that lost an ETag, or made one up, cannot affect what is stored.
 */
export async function completeMultipartUpload(key: string, uploadId: string): Promise<number> {
  const { Parts } = await s3().send(new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }))
  const parts = (Parts ?? [])
    .filter((part) => part.PartNumber !== undefined && part.ETag)
    .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0))
    .map((part) => ({ PartNumber: part.PartNumber, ETag: part.ETag }))
  if (parts.length === 0) throw new UserFacingError(IMPORTANT_FILES_MESSAGES.uploadFailed)

  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  )
  return parts.length
}

/** Throws away a multipart upload and the parts already sent, so nothing is left paying rent. */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  await s3()
    .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }))
    .catch((error: unknown) => {
      console.warn("⚠️ Couldn't abort the multipart upload:", error instanceof Error ? error.message : error)
    })
}

/** What S3 actually stored, which is how the server checks the upload rather than trusting it. */
export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const { ContentLength, ContentType } = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { size: ContentLength ?? 0, contentType: ContentType ?? "application/octet-stream" }
  } catch {
    return null
  }
}

/**
 * A link that opens the file for a short while. `downloadAs` makes the browser save it under the
 * user's own name for it instead of showing it.
 */
/**
 * The bytes of one stored object, read on the server through the SDK (so it is retried like every
 * other S3 call), or null when the object is missing. For the app's own reads; the browser still
 * gets a signed link.
 */
export async function getObjectBytes(key: string, signal?: AbortSignal): Promise<Buffer | null> {
  try {
    const answer = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: signal })
    return answer.Body ? Buffer.from(await answer.Body.transformToByteArray()) : null
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) return null
    throw error
  }
}

export function presignDownload(key: string, contentType: string, downloadAs?: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: contentType,
      ...(downloadAs
        ? { ResponseContentDisposition: `attachment; filename="${downloadAs.replace(/["\\]/g, "")}"` }
        : {}),
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  )
}

/** Copies one object to another key in the same bucket, on the storage side: the bytes never pass through here. */
export async function copyObject(fromKey: string, toKey: string): Promise<void> {
  const source = `${bucket()}/${fromKey.split("/").map(encodeURIComponent).join("/")}`
  await s3().send(new CopyObjectCommand({ Bucket: bucket(), Key: toKey, CopySource: source }))
}

/** Removes the object. A key that is already gone counts as removed. */
export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}
