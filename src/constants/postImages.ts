import { ImagePlus, type LucideIcon } from "lucide-react"

/**
 * Post Image Creator: the picture that goes with a post, drawn to the user's own brand.
 *
 * The brand defaults (the name, the colours and the reusable photos) are saved once and used by
 * every image after that. Each finished image keeps a copy of the settings it was made with, so
 * changing the defaults later never rewrites what an older image says about itself.
 */

// A palette, not a rainbow. Enough for a background, a panel, text and an accent or two
export const MAX_BRAND_COLORS = 8
export const MIN_BRAND_COLORS = 1
// #rgb or #rrggbb, the two forms a designer actually types
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const MAX_BRAND_ASSETS = 12
export const ASSET_NAME_MAX_LENGTH = 60
export const DISPLAY_NAME_MAX_LENGTH = 60
export const POST_CONTENT_MAX_LENGTH = 2000

// What the image model takes as an input photo, and what the app therefore accepts
export const ASSET_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const ASSET_MAX_BYTES = 8 * 1024 * 1024
export const ASSET_MAX_LABEL = "8 MB"

/**
 * How the person in the chosen photo should appear. Each one is written into the request as an
 * instruction, so the choice is a real part of the image rather than a label on a form.
 */
export const ASSET_POSES = [
  {
    id: "standing",
    label: "Standing",
    description: "Upright, facing you",
    instruction: "Show the person standing, upper body and above, facing the viewer.",
  },
  {
    id: "sitting",
    label: "Sitting",
    description: "At a desk or chair",
    instruction: "Show the person sitting, upper body and above, in a relaxed working posture.",
  },
  {
    id: "side",
    label: "Side angle",
    description: "Turned away slightly",
    instruction: "Show the person from a three quarter side angle, shoulders turned away from the viewer.",
  },
  {
    id: "looking-at-design",
    label: "Looking at the message",
    description: "Eyes on the headline",
    instruction:
      "Show the person on one side of the image, turned towards the text and looking at it, so the eye follows them to the words.",
  },
  {
    id: "dynamic",
    label: "Dynamic pose",
    description: "Mid gesture, talking",
    instruction:
      "Show the person mid gesture, as if making a point while speaking, with an open and natural posture.",
  },
  {
    id: "headshot",
    label: "Head and shoulders",
    description: "Close cut out",
    instruction: "Show the person from the shoulders up, close to the camera, as a clean cut out against the design.",
  },
] as const

export type AssetPoseId = (typeof ASSET_POSES)[number]["id"]
export const ASSET_POSE_IDS = ASSET_POSES.map((pose) => pose.id) as [AssetPoseId, ...AssetPoseId[]]
export const DEFAULT_POSE: AssetPoseId = "standing"

export function poseInstruction(pose: AssetPoseId): string {
  return ASSET_POSES.find((entry) => entry.id === pose)?.instruction ?? ASSET_POSES[0].instruction
}

export function getPoseLabel(pose: AssetPoseId): string {
  return ASSET_POSES.find((entry) => entry.id === pose)?.label ?? pose
}

/** The shapes the image model actually takes, named as a person would pick them. */
export const IMAGE_SIZES = [
  { id: "square", label: "Square", description: "1024 x 1024", value: "1024x1024", width: 1024, height: 1024 },
  { id: "portrait", label: "Portrait", description: "1024 x 1536", value: "1024x1536", width: 1024, height: 1536 },
  { id: "landscape", label: "Landscape", description: "1536 x 1024", value: "1536x1024", width: 1536, height: 1024 },
] as const

export type ImageSizeId = (typeof IMAGE_SIZES)[number]["id"]
export const IMAGE_SIZE_IDS = IMAGE_SIZES.map((size) => size.id) as [ImageSizeId, ...ImageSizeId[]]
export const DEFAULT_IMAGE_SIZE: ImageSizeId = "square"

export function imageSize(size: ImageSizeId) {
  return IMAGE_SIZES.find((entry) => entry.id === size) ?? IMAGE_SIZES[0]
}

// The gallery's photo filter: one pose, or images made with no photo at all
export const NO_PHOTO_FILTER = "none"
export const PHOTO_FILTER_OPTIONS = [
  { id: NO_PHOTO_FILTER, label: "No photo" },
  ...ASSET_POSES.map((pose) => ({ id: pose.id, label: `Photo, ${pose.label.toLowerCase()}` })),
]

export const POST_IMAGES_PROMPT_ID = "post-image"
export const POST_IMAGES_PROMPT_TABS = [{ id: POST_IMAGES_PROMPT_ID, label: "Post image" }]

export const POST_IMAGES_ENDPOINT = "/api/post-images"
export const POST_IMAGES_HISTORY_HREF = "/post-image-creator/history"

export const POST_IMAGES_MESSAGES = {
  missingContent: "Say what the post is about, so the picture has something to be about.",
  contentTooLong: `Keep the post content under ${POST_CONTENT_MAX_LENGTH.toLocaleString()} characters.`,
  missingName: "Add the name you want on your posts.",
  nameTooLong: `The name must be under ${DISPLAY_NAME_MAX_LENGTH} characters.`,
  badColor: "Colours are hex codes, for example #5b21b6.",
  tooManyColors: `Up to ${MAX_BRAND_COLORS} colours.`,
  noColors: "Add at least one brand colour.",
  tooManyAssets: `Up to ${MAX_BRAND_ASSETS} saved photos. Remove one to add another.`,
  missingAssetName: "Give this photo a name, so you can pick it later.",
  unsupportedAsset: "Photos can be PNG, JPEG or WEBP.",
  assetTooLarge: `Each photo must be under ${ASSET_MAX_LABEL}.`,
  assetUploadFailed: "Couldn't save that photo. Please try again.",
  assetGone: "That photo is not saved any more. Add it again from your files.",
  modelUnavailable: "Image generation isn't configured. Set OPENAI_IMAGE_MODEL in .env.local (see .env.example).",
  storageUnavailable: "File storage isn't configured. Set the AWS variables in .env.local (see .env.example).",
  generationFailed: "Couldn't draw the image. Please try again.",
  refused: "The image provider refused this request. Try different wording for the post content.",
  saved: "Saved.",
  generated: "Image ready.",
  deleted: "Deleted.",
  loadFailed: "Couldn't load your images.",
  notFound: "That image no longer exists.",
  copyFailed: "This browser can't copy an image to the clipboard. Download it instead.",
  copied: "Image copied.",
  emptyHistory: "No post images yet. Make one and it lands here.",
} as const

// The module's sidebar entry, with the other things made for a post
export const POST_IMAGES_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "linkedin"
} = {
  id: "post-image-creator",
  title: "Post Image Creator",
  description: "On-brand images for posts",
  icon: ImagePlus,
  href: "/post-image-creator",
  group: "linkedin",
}
