"use client"

import React, { useState } from "react"
import { FilePenLine, Layers, Settings2 } from "lucide-react"
import { APP_TOOLS } from "@/constants/linkedinTools"
import { ADMIN_PROMPT_MESSAGES, MODULE_PROMPT_TOOLS, SHARED_PROMPTS_DESCRIPTION, SHARED_PROMPTS_LABEL, SHARED_PROMPT_TOOL } from "@/constants/adminPrompts"
import { SystemPromptsModal } from "@/components/admin/SystemPromptsModal"
import { DEFAULT_REPLY_CONTEXT } from "@/constants/postCommentReplies"
import { CONVERSATION_REPLY_PROMPT_TABS } from "@/constants/conversationReply"
import { ConnectionNotePromptsModal } from "@/components/connection-note/ConnectionNotePromptsModal"
import { TunePromptsModal } from "@/components/comment-writer/TunePromptsModal"
import { ReplyPromptsModal } from "@/components/post-comment-replies/ReplyPromptsModal"
import { FollowUpPromptsModal } from "@/components/follow-up-message/FollowUpPromptsModal"
import { FirstMessagePromptsModal } from "@/components/first-message/FirstMessagePromptsModal"
import { InMailPromptsModal } from "@/components/inmail/InMailPromptsModal"
import { ConversationReplyPromptsModal } from "@/components/conversation-reply/ConversationReplyPromptsModal"
import { TrendingPromptModal } from "@/components/trending-topics/TrendingPromptModal"
import { PostImagePromptModal } from "@/components/post-images/PostImagePromptModal"
import { ClientMessagePromptModal } from "@/components/client-messaging/ClientMessagePromptModal"
import { ClientVoicesPromptModal } from "@/components/client-voices/ClientVoicesPromptModal"
import { MeetingPlannerPromptsModal } from "@/components/meeting-planner/MeetingPlannerPromptsModal"
import { MeetingsPromptModal } from "@/components/meetings/MeetingsPromptModal"
import { MessageRewriterPromptModal } from "@/components/message-rewriter/MessageRewriterPromptModal"
import { PromptCreatorPromptsModal } from "@/components/prompt-creator/PromptCreatorPromptsModal"

/**
 * Every module's prompts, edited from one place by an admin: the module's name and an Update button
 * that opens that module's own prompt editor (the same one its page used to open). Prompts are shared
 * by every account, so a change made here is what every account's next generation uses, on every
 * device; that is why only an admin may make it, and why no tool page offers it any more.
 *
 * The modules and their order come from `APP_TOOLS`, the app's one navigation source, so each reads
 * here exactly as it does in the sidebar. A module listed below that is not in the sidebar is left
 * out rather than shown nameless (`tests/adminPrompts.test.mjs` checks every one of them is there).
 */

type Editor = (onClose: () => void) => React.ReactNode

// What each module's Update opens, keyed by the module's id in APP_TOOLS
export const MODULE_PROMPT_EDITORS: Record<string, Editor> = {
  "comment-writer": (onClose) => <TunePromptsModal initialTune={null} onClose={onClose} />,
  "post-comment-replies": (onClose) => <ReplyPromptsModal initialContext={DEFAULT_REPLY_CONTEXT} initialStyle={null} onClose={onClose} />,
  "inmail-composer": (onClose) => <InMailPromptsModal initialTab={null} onClose={onClose} />,
  "follow-up-message": (onClose) => <FollowUpPromptsModal initialTab={null} onClose={onClose} />,
  "first-message": (onClose) => <FirstMessagePromptsModal initialTab={null} onClose={onClose} />,
  "connection-note": (onClose) => <ConnectionNotePromptsModal initialTone={null} onClose={onClose} />,
  "conversation-reply": (onClose) => <ConversationReplyPromptsModal initialTab={CONVERSATION_REPLY_PROMPT_TABS[0].id} onClose={onClose} />,
  "trending-topics": (onClose) => <TrendingPromptModal onClose={onClose} />,
  "post-image-creator": (onClose) => <PostImagePromptModal onClose={onClose} />,
  "prompt-creator": (onClose) => <PromptCreatorPromptsModal initialTarget={null} onClose={onClose} />,
  "message-rewriter": (onClose) => <MessageRewriterPromptModal onClose={onClose} />,
  "meeting-planner": (onClose) => <MeetingPlannerPromptsModal onClose={onClose} />,
  "client-voices": (onClose) => <ClientVoicesPromptModal onClose={onClose} />,
  meetings: (onClose) => <MeetingsPromptModal initialTab={null} onClose={onClose} />,
  "client-messaging": (onClose) => <ClientMessagePromptModal onClose={onClose} />,
}

// Every module with prompts of its own (an editor, system prompts or both), in sidebar order, then
// the prompts every tool shares
const ROWS = [
  ...APP_TOOLS.filter((tool) => tool.id in MODULE_PROMPT_EDITORS || tool.id in MODULE_PROMPT_TOOLS).map((tool) => ({
    id: tool.id,
    title: tool.title,
    description: tool.description,
    icon: tool.icon,
    tool: MODULE_PROMPT_TOOLS[tool.id] ?? null,
  })),
  { id: SHARED_PROMPT_TOOL, title: SHARED_PROMPTS_LABEL, description: SHARED_PROMPTS_DESCRIPTION, icon: Layers, tool: SHARED_PROMPT_TOOL },
]

export const ModulePromptsPanel: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(null)
  // The module whose system prompts are open
  const [systemFor, setSystemFor] = useState<(typeof ROWS)[number] | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-bold text-on-surface">Module prompts</h2>
        <p className="mt-0.5 text-[13px] text-on-surface-variant">
          Update edits the prompts a module&apos;s users choose between (its tones, tunes and styles); System edits everything else it sends the
          AI. A saved change applies to every account and every device from the next result written.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {ROWS.map((tool) => {
          const Icon = tool.icon
          return (
            <li
              key={tool.id}
              className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-white px-4 py-3 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-on-surface">{tool.title}</span>
                <span className="block truncate text-[12px] text-on-surface-variant">{tool.description}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {tool.tool && (
                  <button
                    type="button"
                    onClick={() => setSystemFor(tool)}
                    aria-label={`${ADMIN_PROMPT_MESSAGES.systemButton} of ${tool.title}`}
                    title={ADMIN_PROMPT_MESSAGES.systemButton}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    <Settings2 size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">System</span>
                  </button>
                )}
                {tool.id in MODULE_PROMPT_EDITORS && (
                  <button
                    type="button"
                    onClick={() => setOpenId(tool.id)}
                    aria-label={`Update the prompts of ${tool.title}`}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                  >
                    <FilePenLine size={15} aria-hidden="true" />
                    Update
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {openId && MODULE_PROMPT_EDITORS[openId]?.(() => setOpenId(null))}
      {systemFor?.tool && <SystemPromptsModal title={systemFor.title} tool={systemFor.tool} onClose={() => setSystemFor(null)} />}
    </section>
  )
}
