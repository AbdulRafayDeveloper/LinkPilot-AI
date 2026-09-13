"use client"

import React, { useCallback, useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Loader2, Reply, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { PostInput } from "@/components/post-input/PostInput"
import { ReplyResult } from "@/components/post-comment-replies/ReplyResult"
import { ReplyPromptsModal } from "@/components/post-comment-replies/ReplyPromptsModal"
import { ResetButton } from "@/components/ui/ResetButton"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { usePostCommentReplyGenerator } from "@/hooks/usePostCommentReplyGenerator"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  DEFAULT_REPLY_CONTEXT,
  DEFAULT_REPLY_STYLE,
  POST_COMMENT_REPLY_MESSAGES,
  REPLY_COMMENTS_MAX_LENGTH,
  REPLY_CONTEXTS,
  REPLY_STYLES,
  type ReplyContextId,
  type ReplyStyleId,
} from "@/constants/postCommentReplies"
import type { PostInputMode } from "@/constants/postInput"

const ID_PREFIX = "post-comment-replies"
const COMMENTS_INPUT_ID = `${ID_PREFIX}-comments`
const COMMENTS_HINT_ID = `${ID_PREFIX}-comments-hint`
const FORM_ERROR_ID = `${ID_PREFIX}-form-error`
const { missingComment } = POST_COMMENT_REPLY_MESSAGES

const POST_PLACEHOLDER = "Paste the original post here. It's optional, but it helps the reply stay on topic."

const COMMENTS_PLACEHOLDER = `Paste the comments you want to reply to, for example:

Sarah Khan: Interesting point. How do you handle urgent fixes?
Omar Farooq: We saw the same thing after switching.`

// Inputs outlive the page, so they're still here after visiting another tool. A screenshot
// stays in memory only: it survives switching tools but not a refresh.
const formStore = createToolStore(
  "post-comment-replies:form",
  {
    context: DEFAULT_REPLY_CONTEXT as ReplyContextId,
    style: DEFAULT_REPLY_STYLE as ReplyStyleId,
    postMode: "text" as PostInputMode,
    postText: "",
    postImage: null as File | null,
    comments: "",
  },
  {
    version: 5,
    toStored: ({ context, style, postMode, postText, comments }) => ({ context, style, postMode, postText, comments }),
  }
)

// Compact cards so the Generate button is on screen without scrolling on laptop-height windows
const cardClass = "bg-white border border-outline-variant rounded-2xl shadow-sm p-4 flex flex-col gap-3"
const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"

export default function PostCommentRepliesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const { context, style, postMode, postText, postImage, comments } = useToolStore(formStore)
  const [formError, setFormError] = useState<string | null>(null)
  const commentsRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, stage, result, error, generate, reset } = usePostCommentReplyGenerator()
  const isGenerating = status === "loading"
  const canReset = postText !== "" || postImage !== null || comments !== "" || status !== "idle"
  // Anything other than the comment message comes from the post input (image checks)
  const isPostError = formError !== null && formError !== missingComment

  const clearPostError = useCallback(
    () => setFormError((current) => (current === missingComment ? current : null)),
    []
  )
  const handlePostImageSelect = useCallback(
    (file: File) => {
      formStore.update({ postImage: file })
      clearPostError()
    },
    [clearPostError]
  )
  const handlePostImageRemove = useCallback(() => formStore.update({ postImage: null }), [])

  // A dummy thread fills the post (as text) and the comments; the reply for the previous thread goes with it
  const loadDummyThread = ({ post, comments }: Record<string, string>) => {
    formStore.update({ postMode: "text", postText: post ?? "", postImage: null, comments: comments ?? "" })
    reset()
    setFormError(null)
  }

  // Clears the post, the comments and the reply; the chosen context and style stay
  const resetTool = () => {
    formStore.update({ postText: "", postImage: null, comments: "" })
    reset()
    setFormError(null)
    commentsRef.current?.focus()
  }

  const submit = () => {
    if (!comments.trim()) {
      setFormError(missingComment)
      commentsRef.current?.focus()
      return
    }
    setFormError(null)
    // The reply always answers the other person's latest comment; the server finds it
    generate({ context, style, comments, postMode, postText, postImage })
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:px-6 md:py-5 lg:px-8 flex flex-col gap-4">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Reply size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Post Comment Replies
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write a natural reply to a comment on your post or in someone else&apos;s thread.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setIsPromptsOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {/* Comments: what to reply to, pasted separately from the post */}
              <section aria-label="Comments" className={cardClass}>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={COMMENTS_INPUT_ID} className={labelClass}>
                      Comments
                    </label>
                    <span className="text-[11px] text-outline">
                      {comments.length.toLocaleString()} / {REPLY_COMMENTS_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    ref={commentsRef}
                    id={COMMENTS_INPUT_ID}
                    value={comments}
                    onChange={(event) => {
                      formStore.update({ comments: event.target.value })
                      if (formError === missingComment) setFormError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        if (!isGenerating) submit()
                      }
                    }}
                    maxLength={REPLY_COMMENTS_MAX_LENGTH}
                    disabled={isGenerating}
                    placeholder={COMMENTS_PLACEHOLDER}
                    aria-invalid={formError === missingComment}
                    aria-describedby={formError === missingComment ? `${COMMENTS_HINT_ID} ${FORM_ERROR_ID}` : COMMENTS_HINT_ID}
                    className="flex-1 w-full min-h-[140px] resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-70"
                  />
                  <p id={COMMENTS_HINT_ID} className="text-[11px] text-outline mt-1.5">
                    Paste one comment or a whole thread. Press Ctrl + Enter to generate.
                  </p>
                </div>

              </section>

              {/* Post (optional): where the comment is, and the original post as text or a screenshot */}
              <section aria-label="Post" className={cardClass}>
                <RadioCardGroup
                  name={`${ID_PREFIX}-context`}
                  legend="Where is the comment?"
                  options={REPLY_CONTEXTS}
                  value={context}
                  onChange={(nextContext) => formStore.update({ context: nextContext })}
                  disabled={isGenerating}
                  columnsClassName="grid-cols-1 min-[440px]:grid-cols-2"
                />
                <PostInput
                  idPrefix={ID_PREFIX}
                  mode={postMode}
                  onModeChange={(nextMode) => {
                    formStore.update({ postMode: nextMode })
                    clearPostError()
                  }}
                  text={postText}
                  onTextChange={(text) => formStore.update({ postText: text })}
                  image={postImage}
                  onImageSelect={handlePostImageSelect}
                  onImageRemove={handlePostImageRemove}
                  onImageReject={setFormError}
                  placeholder={POST_PLACEHOLDER}
                  optional
                  compact
                  disabled={isGenerating}
                  invalid={isPostError}
                  describedBy={isPostError ? FORM_ERROR_ID : undefined}
                />
              </section>

              {/* Style and action, under the comments */}
              <div className={cardClass}>
                <RadioCardGroup
                  name={`${ID_PREFIX}-style`}
                  legend="Reply style"
                  options={REPLY_STYLES}
                  value={style}
                  onChange={(nextStyle) => formStore.update({ style: nextStyle })}
                  disabled={isGenerating}
                  columnsClassName="grid-cols-2 min-[480px]:grid-cols-3"
                  wrapLabels
                />

                {formError && (
                  <p id={FORM_ERROR_ID} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-error">
                    <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                    {formError}
                  </p>
                )}

                {/* The card's footer sticks to the bottom of the window on short screens, so Generate is always one click away */}
                <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto px-4 pb-4 pt-3 bg-white rounded-b-2xl border-t border-outline-variant/50">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    aria-busy={isGenerating}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={16} aria-hidden="true" />
                    )}
                    {isGenerating ? "Generating reply..." : "Generate Reply"}
                  </button>
                </div>
              </div>

              <ReplyResult status={status} stage={stage} result={result} error={error} onRetry={submit} />
            </form>
          </div>
        </main>
      </div>

      {isPromptsOpen && (
        <ReplyPromptsModal initialContext={context} initialStyle={style} onClose={() => setIsPromptsOpen(false)} />
      )}
      {isDummyDataOpen && (
        <DummyDataModal kind="comment-threads" onUse={loadDummyThread} onClose={() => setIsDummyDataOpen(false)} />
      )}
    </div>
  )
}
