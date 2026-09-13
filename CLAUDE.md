# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**LinkPilot AI** (`package.json` name: `linkpilot-ai`) is a set of exactly **8 LinkedIn writing tools**. Each one takes pasted LinkedIn text and generates copy the user posts themselves:

| Route | Tool | What it generates |
|---|---|---|
| `/trending-topics` | Trending Topics | 6 fresh, source-backed web/AI/SaaS topics from live web research, each with a ready-to-post LinkedIn post |
| `/connection-note` | Connection Note | ≤300-char invite note, 4 tones |
| `/comment-writer` | Comment Writer | a comment on someone's post (text or screenshot), 6 tunes |
| `/post-comment-replies` | Post Comment Replies | a reply to one comment, 2 contexts × 6 tones (Show Expertise, Ask Their Opinion, Give Useful Tips, Share Real Example, Politely Disagree, Invite to DM), written as Abdul Rafay to the other person's latest comment |
| `/follow-up-message` | Follow-Up Message | a follow-up from a pasted conversation, 2 types |
| `/first-message` | First Message | a first DM from a profile, 5 tones (Curiosity Hook default) |
| `/inmail-message` | InMail Composer | subject + message from a profile, 4 tones (Trigger Event default) |
| `/conversation-reply` | Conversation Reply | analysis + next reply from a conversation, 6 tones (Validate + Share Pattern default) |

`/` redirects to the first tool. There is no chat, knowledge base, analytics, inspector or auth. Those were removed on purpose, so don't reintroduce them. `src/constants/linkedinTools.ts` (`LINKEDIN_TOOLS`) is the single list that drives the sidebar and the sitemap.

`ai_docs/` holds planning docs from the project this code was forked from (the "Enterprise Support AI Hub"). They describe features that no longer exist. `README.md` is empty and the git repo has no commits yet.

## Commands

```bash
npm install          # .npmrc sets legacy-peer-deps=true; LangChain peer ranges conflict without it
npm run dev          # next dev (Next.js 16, Turbopack) → http://localhost:3000
npm run build        # production build (build.bat just runs this)
npm run start        # serve the production build
npm run lint         # runs bare `eslint` (flat config; Next 16 no longer ships `next lint`)
npx tsc --noEmit     # type-check; there is no script for it
```

- Next 16 allows only one `next dev` per project folder. If another one is running, use it instead of starting a second.
- `tsc` also checks the generated `.next/types/validator.ts`. After you delete a route it reports stale "Cannot find module" errors until the next `npm run build` regenerates that file.
- There is no test framework. Verify changes by calling the API routes, or by using the pages, against a running server.

## Environment

`src/config/env.ts` is the only place that reads env vars. It is a Zod schema where blank values count as unset.
- Every URL, secret and model name comes from env, and none has a fallback value in code. Never hardcode one or add a default.
- A missing required var makes the app refuse to start, with an error that names it.
- `env.ts` is server-only. Client components get the site name from `config/site.ts`, never from env.
- Every var must also be documented in `.env.example`, and `.gitignore`'s `.env*` rule also ignores that file, so add `!.env.example` if it needs to be committed.

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | **Required.** Public origin for canonical links, the sitemap, robots and JSON-LD (exported as `SITE_URL`). |
| `MONGODB_URI` | **Required.** Saved prompts and the About Me profile (`Setting` model). |
| `PROMPT_EDITOR_PASSWORD` | Password for every Update Prompt editor. If unset, prompt editing is locked for everyone. |
| `GOOGLE_API_KEY` + `GEMINI_LIGHTWEIGHT_MODEL` | **Primary** provider (Gemini), plus Google Search grounding for research. |
| `OPENAI_API_KEY` + `OPENAI_LIGHTWEIGHT_MODEL` | **Fallback** provider (GPT-4o Mini), plus OpenAI web search for research. |

Model names live **only** in env. Never hardcode a model id in code. Gemini 1.5 models are retired and return 404. The free Gemini tier has a small per-day request quota, and once it's used up every call falls back to OpenAI.

## AI architecture (`src/services/ai.ts`)

- `AI_PROVIDERS = ["gemini", "openai"]` is the full provider set. Don't add other providers (Grok/xAI, Anthropic, etc.).
- `createGeminiModel()` and `createOpenAIModel()` are the only places a LangChain chat model is constructed.
- `generateStructuredWithFallback({ schema, name, messages, validate?, providers?, onFallback?, timeoutMs?, signal? })` is how every tool generates. It tries Gemini first. If Gemini isn't configured, fails, times out (default 45s), returns output that fails the schema, or fails `validate`, it moves to OpenAI. It throws `UserFacingError` when no provider is configured. `onFallback` lets streaming tools show "switching to the backup model".
- `services/senderGuard.ts` wraps it for outreach tools. It detects invented claims about the sender (the `SENDER_CLAIM` regex) and asks for one rewrite.
- `services/liveResearch.ts` (`runLiveResearch`) handles web research for Trending Topics, Comment Writer and Post Comment Replies:
  - It tries Gemini with `{ googleSearch: {} }` grounding first. Only grounding chunks count as sources, and their Google redirect URIs are resolved to real URLs.
  - Both providers take a list of passes (`geminiPasses`, `openAIPasses`) that run in parallel and are merged; failed passes are skipped. Trending runs one pass per lens in `trending-search-lenses.md` (so 3 Gemini research calls + 1 synthesis call per search); Comment Writer and Post Comment Replies use a single Gemini pass.
  - It falls back to OpenAI Responses `tools.webSearch()`, running parallel passes with `tool_choice: "required"`.
- **Humanization (`services/humanizer.ts`, `humanizeTexts`) is the last step of all 8 tools.** Each tool passes its final, already-verified texts (note, message, InMail subject + message, reply, comment, Trending hooks + bodies) through the user's saved **Humanization** prompt from Global AI Prompts (`global_prompt:humanization`, default `prompts/global-humanization.md`, `{{text}}` = the drafts), under the fixed rules in `prompts/humanizer-system.md`.
  - One structured call per result, each text as a `<draft id=… kind=… max_chars=… one_line=… rule=…>`. Code judges every rewrite on its own: same numbers, links, hashtags and @mentions; no new sender claim or placeholder; within `maxChars`/one line; plus the tool's own `validate(id, text)` (comment checks, conversation-reply problem checks, post-reply experience claims, Trending word limits).
  - Failed texts get one targeted retry told exactly what broke (the backup provider takes over if that still fails); a text that never passes keeps its verified draft. Every tool logs `humanized`. New tools must humanize their output too.
  - Global AI Prompts page: `/global-prompts` (`constants/globalPrompts.ts`, `services/globalPrompts.ts`); Rafay Profile Info is Abdul's facts source for Post Comment Replies (with About Me).

## Architecture

### Page pattern
Each tool route has two parts:
- A thin server `page.tsx` that holds only metadata and JSON-LD.
- A `"use client"` `*Client.tsx` that composes `Sidebar` and `Header` from `src/components/ui/`. Sidebar collapse state comes from `hooks/useSidebarCollapse` (localStorage key `isSidebarCollapsed`).

### Tool state survives switching tools (`lib/toolStore.ts`)
- Never keep a tool's inputs or results in component `useState`: leaving the page would lose them. Each tool has module-level stores made with `createToolStore(name, initial, { version, toStored })`, read with `useToolStore` (`useSyncExternalStore`): a `<tool>:form` store in its `*Client.tsx` and a `<tool>:result` store for the generation (`createGenerationRequest` in `hooks/useGenerationRequest.ts` for JSON tools; `useCommentGenerator`, `usePostCommentReplyGenerator`, `useTrendingTopicsSearch` for the streaming ones).
- Requests are never aborted on unmount, so a generation started before switching tools finishes into the store; only a newer request or Reset cancels it (and a cancelled request never writes).
- Stores mirror to `localStorage` (`linkpilot:tool:<name>`) for 24h after the last change. `toStored` keeps uploaded `File`s (memory only) and unfinished requests out of storage. Bump `version` when a store's shape changes.
- Every tool header has `components/ui/ResetButton` next to Update Prompt: it clears the pasted/uploaded data and the result, and keeps the chosen tone/tune/type/style/context.

Styling is Tailwind with Material-3 color tokens from `tailwind.config.ts` (`bg-surface-container`, `text-on-surface-variant`, `bg-primary-container`, …). Use those tokens, not raw colors. The app is light theme only.

### Layers
- `src/app/api/<tool>/generate` and `…/prompts[/<id>]`: route handlers. They Zod-validate input and return `{ success, message, data }`. Dynamic `params` is a `Promise` and must be awaited.
  - Research-heavy tools (Trending Topics, Comment Writer, Post Comment Replies) stream Server-Sent Events via `lib/sse.ts`: `{status, text}` stages, then `COMPLETE` with the result or `ERROR`.
  - The other tools return JSON.
- `src/services/<tool>/`: generation logic per tool. Shared services:
  - `promptComposer` inserts `{{variable}}` placeholders into the template, or appends the data when the placeholder is missing, and strips data tags from untrusted input.
  - `promptStore` and `prompts` load templates.
  - `senderProfile` and `senderContext` provide the About Me profile.
  - `postImage` extracts post text from screenshots.
  - `outreachPrompts` is the prompt factory for First Message and InMail.
- `src/prompts/*.md`: default prompt templates, read from disk by `loadPrompt()`. It throws if a file is missing, and `next.config.ts` bundles them with the API routes. Keep prompts in these files, not in code.
- `src/constants/`: tool option lists (tones, tunes, styles), LinkedIn character limits and user-facing messages.
- `src/models/Setting.ts`: the only Mongoose model, holding key/value records for saved prompts.

### Editable prompts
- Every tone, tune or style has its **own independent prompt**. It's stored in `Setting` under its own key, and the `.md` file supplies the default.
- `saveStoredPrompt` deletes the record when the text equals the default, so later improvements to the default apply again.
- **About Me** (`sender_profile` key, edited from First Message or InMail → Update Prompt → About Me) is the only source of facts about the user. Tools must never claim experience it doesn't contain, and while it's still the unfilled template, tools treat it as empty.
- Post Comment Replies still accepts `{{knowledge_base}}` as an alias of `{{sender_profile}}` for older saved prompts.

### Update Prompt UI (keep consistent across all 8 tools)
- `components/prompts/PromptTabsModal` is the shared editor:
  - It uses the `Modal size="large"` panel (≈95vw × 92dvh) with internal scrolling.
  - `PromptTabStrip` renders the segmented tabs, following Connection Note's visual pattern.
  - `PromptEditorField` is a textarea that fills the panel.
  - The tab strip is hidden when there's only one prompt.
- Each tool has a thin wrapper that supplies its tabs, a load/save API and a hint: `ConnectionNotePromptsModal`, `TrendingPromptModal`, `OutreachPromptsModal` (First Message and InMail), `TunePromptsModal`, `FollowUpPromptsModal`, `ConversationReplyPromptsModal`.
- `ReplyPromptsModal` (Post Comment Replies) uses two `PromptTabStrip` rows, one for context and one for style.
- Drafts are kept per tab while an editor is open, and one Save stores **every edited tab** (`components/prompts/saveEditedPrompts.ts`, in parallel; the button reads "Save N Prompts"). A blank edited tab blocks the save; if some fail, the saved ones stick, the failed ones stay edited, and the editor switches to the first problem tab instead of closing.
- Results render through `ResultCard` / `GeneratedResultPanel` with `CopyButton variant="prominent"`.

### Prompt password (`services/promptAccess.ts`, no database)
- Both editor bases (`PromptTabsModal`, `ReplyPromptsModal`) render inside `PromptAccessGate`. The editor mounts, and loads prompts, only after `GET /api/prompt-access` reports `unlocked`.
- `POST /api/prompt-access` checks the password against env:
  - A correct password sets a signed httpOnly `lp_prompt_session` cookie, valid 48h, that covers every tool.
  - Each wrong password is counted in a signed `lp_prompt_attempts` cookie. The 3rd locks that browser for 24h, and while locked even the correct password is refused.
  - Cookies are HMAC-signed with a key derived from the password, so changing the password ends every session.
- Every prompt API handler (all `…/prompts` routes and `trending-topics/prompt`, GET and PUT) starts with `requirePromptAccess()`. New prompt routes must too. Generation routes stay open.
- This is intentionally light security: clearing cookies resets the attempt counter.

### Lead Signals (Follow-Up Message, Conversation Reply)
- One shared 16-row table (`components/lead-signals/LeadSignalsTable`, row order = the owner's chosen order), service (`services/leadSignals.ts`, `assessLeadSignalsSafely` runs alongside the main generation and returns null instead of failing it), types (`types/leadSignals.ts`), label options (`constants/leadSignals.ts`) and fixed rules (`prompts/lead-signals-system.md`).
- Each tool keeps its **own** editable "Lead Signals" prompt tab (`follow_up_prompt:lead-signals` / `conversation_reply_prompt:lead-signals`, defaults `follow-up-lead-signals.md` / `conversation-reply-lead-signals.md`), so editing one never changes the other. The signals never see the chosen type or tone.

### Dummy Data (every tool with an input)
- `constants/dummyData.ts` (`DUMMY_DATA_KINDS`) registers each kind, its folder and its fields (key, label, limit = the input it fills, required):
  - `profiles` → `src/data/dummy-profiles/` (profile), shared by Connection Note, First Message and InMail
  - `posts` → `src/data/dummy-posts/` (post), Comment Writer
  - `comment-threads` → `src/data/dummy-comment-threads/` (post optional + comments), Post Comment Replies
  - `follow-up-conversations` → `src/data/dummy-follow-up-conversations/` (conversation + optional profile), Follow-Up
  - `reply-conversations` → `src/data/dummy-reply-conversations/` (conversation + optional profile), Conversation Reply
  - Trending Topics has no input, so no kind. Adding a kind = a registry entry + its folder.
- Items are markdown files `<id>.md`: front matter (`name`, `createdAt`), then the text. A one-field kind stores its text as is; a multi-field kind starts each field with a `<!-- field: key -->` line. The file name is the id. No database. `services/dummyData.ts` reads and writes them (ids must match `DUMMY_ITEM_ID_PATTERN`, new files are created exclusively), and `next.config.ts` ships `src/data` with the API routes.
- `GET/POST /api/dummy-data/[kind]` and `PUT/DELETE /api/dummy-data/[kind]/[id]` (body `{ name, fields }`) all start with `requirePromptAccess()`. Writes need a writable file system; on a read-only host they fail with a clear message.
- `components/dummy-data/DummyDataModal` (`kind` prop, behind `PromptAccessGate`) edits items like prompts (one tab each, add, two-step delete, auto-close after save), with a Copy button per field. **Use this …** passes all fields to the tool's `onUse`, which fills its inputs, clears the previous result and closes the popup. `DummyDataButton` sits in each tool header.
- Sample conversations use LinkedIn-style "Name  date" sender lines with the owner as Abdul Rafay; all seed items are fictional.

### Post Comment Replies
- Replies are written as `REPLY_AUTHOR_NAME` (Abdul Rafay). There is no comment picker: `resolveTargetComment` always answers the latest parsed comment not written by him (`isReplyAuthor`); his own comments are context only.
- Style prompts can place `{{conversation}}`, `{{post_content}}`, `{{latest_comment}}` / `{{comment}}` (the comment being answered), `{{sender_profile}}` and `{{web_research}}`; anything not placed is appended, without repeating placed parts.
- `<sender_profile>` is always included: About Me plus Rafay Profile Info (Global AI Prompts). It is the only source of facts, numbers and projects about Abdul; contact details from it never go into a reply.
- Replies are short and plain: at most `REPLY_TARGET_MAX_CHARS` (280, aim 200–270) and no colons, semicolons, dashes or commas (commas inside numbers are fine). The system prompt, every style prompt and the humanizer's `maxChars`/`rule` all enforce it.
- After the first draft, code checks for unsupported experience claims, unnamed client stories, figures (number + unit, in digits or words, "percent" = "%") that appear in none of the sources (profile, post, comments, style prompt), replies over 280 characters and stiff punctuation (`STIFF_PUNCTUATION`), and runs up to `MAX_REWRITES` targeted rewrites, keeping the cleanest version. Markdown marks are stripped.

### Trending Topics
- The default brief (`prompts/trending-topics.md`) targets the owner's domain: web development, AI, and SaaS/MVPs for founders. Mobile apps and consumer hardware are excluded. A saved custom prompt overrides the file.
- `TRENDING_TOPIC_COUNT` (6) caps the topics. Each topic's post is a `post_hook` (≤12 words, scroll-stopping) plus a 1–2 line `post_body`; `lib/trendingPost.ts` (`composeTrendingPost`) assembles hook, body, primary reference URL and hashtags into the one text the card shows and copies. Topics whose hook or body still contain a `[placeholder]` are rejected.


## Project rules (`ai_docs/AI_PROJECT_RULES.md`)
- Keep `page.tsx` thin, with no business logic in it.
- TypeScript is strict. Don't use `any`, and don't disable lint, type or build checks.
- Zod-validate every API input.
- Use `next/image` over `<img>`.
- No unused or commented-out code, no duplication, no mocks or placeholder APIs.
