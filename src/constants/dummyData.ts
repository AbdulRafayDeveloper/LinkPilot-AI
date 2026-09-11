import { PROFILE_DATA_MAX_LENGTH } from "@/constants/connectionNote"
import { POST_TEXT_MAX_LENGTH } from "@/constants/postInput"
import { REPLY_COMMENTS_MAX_LENGTH } from "@/constants/postCommentReplies"
import { CONVERSATION_MAX_LENGTH, FOLLOW_UP_PROFILE_MAX_LENGTH } from "@/constants/followUp"
import {
  CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH,
  CONVERSATION_REPLY_PROFILE_MAX_LENGTH,
} from "@/constants/conversationReply"

export interface DummyDataField {
  key: string
  label: string
  placeholder: string
  // The limit of the tool input this field fills
  maxLength: number
  required: boolean
}

interface DummyDataKindConfig {
  folder: string
  item: string
  description: string
  namePlaceholder: string
  fields: readonly DummyDataField[]
}

const PROFILE_FIELD: DummyDataField = {
  key: "profile",
  label: "Profile data",
  placeholder: "Paste the complete LinkedIn profile page here...",
  maxLength: PROFILE_DATA_MAX_LENGTH,
  required: true,
}

/**
 * Dummy Data registry. Each kind is a folder of markdown files in src/data (one file per
 * item) whose fields fill a tool's inputs. Adding a kind means adding an entry here and
 * its folder; the API, storage and popup stay the same.
 */
export const DUMMY_DATA_KINDS = {
  // Shared by every tool that starts from someone's profile
  profiles: {
    folder: "dummy-profiles",
    item: "profile",
    description:
      "Sample LinkedIn profiles, shared by Connection Note, First Message and InMail. Each one is its own markdown file: edit, add or remove them here, copy one, or use it to fill the profile input.",
    namePlaceholder: "e.g. Jane Doe, SaaS founder",
    fields: [PROFILE_FIELD],
  },
  posts: {
    folder: "dummy-posts",
    item: "post",
    description:
      "Sample LinkedIn posts for Comment Writer. Each one is its own markdown file: edit, add or remove them here, copy one, or use it to fill the post input.",
    namePlaceholder: "e.g. SaaS founder on MVP lessons",
    fields: [
      {
        key: "post",
        label: "Post text",
        placeholder: "Paste the complete LinkedIn post here...",
        maxLength: POST_TEXT_MAX_LENGTH,
        required: true,
      },
    ],
  },
  "comment-threads": {
    folder: "dummy-comment-threads",
    item: "comment thread",
    description:
      "Sample posts with their comments for Post Comment Replies. Each one is its own markdown file: edit, add or remove them here, copy a part, or use one to fill the post and comments inputs.",
    namePlaceholder: "e.g. My post on AI agents, 3 comments",
    fields: [
      {
        key: "post",
        label: "Original post (optional)",
        placeholder: "Paste the original LinkedIn post here...",
        maxLength: POST_TEXT_MAX_LENGTH,
        required: false,
      },
      {
        key: "comments",
        label: "Comments",
        placeholder: "Paste the comments, e.g. \"Sarah Khan: How do you handle urgent fixes?\"",
        maxLength: REPLY_COMMENTS_MAX_LENGTH,
        required: true,
      },
    ],
  },
  "follow-up-conversations": {
    folder: "dummy-follow-up-conversations",
    item: "conversation",
    description:
      "Sample LinkedIn conversations that need a follow-up (you wrote last and haven't heard back). Each one is its own markdown file: edit, add or remove them here, copy a part, or use one to fill the conversation and profile inputs.",
    namePlaceholder: "e.g. Sara, no reply after my proposal",
    fields: [
      {
        key: "conversation",
        label: "Previous conversation",
        placeholder: "Paste the LinkedIn conversation here...",
        maxLength: CONVERSATION_MAX_LENGTH,
        required: true,
      },
      {
        key: "profile",
        label: "Their profile (optional)",
        placeholder: "Paste the other person's LinkedIn profile here...",
        maxLength: FOLLOW_UP_PROFILE_MAX_LENGTH,
        required: false,
      },
    ],
  },
  "reply-conversations": {
    folder: "dummy-reply-conversations",
    item: "conversation",
    description:
      "Sample LinkedIn conversations waiting for your reply (they wrote last). Each one is its own markdown file: edit, add or remove them here, copy a part, or use one to fill the conversation and profile inputs.",
    namePlaceholder: "e.g. Founder asking about pricing",
    fields: [
      {
        key: "conversation",
        label: "Previous conversation",
        placeholder: "Paste the LinkedIn conversation here...",
        maxLength: CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH,
        required: true,
      },
      {
        key: "profile",
        label: "Their profile (optional)",
        placeholder: "Paste the other person's LinkedIn profile here...",
        maxLength: CONVERSATION_REPLY_PROFILE_MAX_LENGTH,
        required: false,
      },
    ],
  },
} as const satisfies Record<string, DummyDataKindConfig>

export type DummyDataKind = keyof typeof DUMMY_DATA_KINDS

export const DUMMY_DATA_KIND_IDS = Object.keys(DUMMY_DATA_KINDS) as [DummyDataKind, ...DummyDataKind[]]

export const DUMMY_DATA_ENDPOINT = "/api/dummy-data"
export const DUMMY_ITEM_NAME_MAX_LENGTH = 100
// Ids are the markdown file names
export const DUMMY_ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function dummyKindConfig(kind: DummyDataKind): DummyDataKindConfig {
  return DUMMY_DATA_KINDS[kind]
}

export function dummyDataMessages(kind: DummyDataKind) {
  const { item } = DUMMY_DATA_KINDS[kind]
  return {
    missingName: `Please give the ${item} a name.`,
    nameTooLong: `The name must be under ${DUMMY_ITEM_NAME_MAX_LENGTH} characters.`,
    missingField: (field: DummyDataField) => `Please paste the ${field.label.toLowerCase()}.`,
    fieldTooLong: (field: DummyDataField) =>
      `${field.label.replace(/\s*\(optional\)$/i, "")} must be under ${field.maxLength.toLocaleString()} characters.`,
    notFound: `That dummy ${item} no longer exists.`,
    readOnly: `Dummy ${item}s can't be saved on this server because its file system is read-only.`,
  }
}
