# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**LinkPilot AI** (`package.json` name: `linkpilot-ai`) is a set of exactly **9 LinkedIn tools**. Eight of them take pasted LinkedIn text and generate copy the user posts themselves; the ninth makes the image that goes with a post:

| Route | Tool | What it generates |
|---|---|---|
| `/trending-topics` | Trending Topics | 6 fresh, source-backed web/AI/SaaS topics from live web research, each with a ready-to-post LinkedIn post |
| `/post-image-creator` | Post Image Creator | a clean post image in the user's own brand colours, with their own photo in it, from whatever the post is about (`/post-image-creator/history` is the gallery of what it has made) |
| `/connection-note` | Connection Note | ≤300-char invite note, 6 tones (incl. Recently Funded: congratulate a funded decision maker and offer to help; Hiring Startup: match a hiring startup's need, portfolio link, 15 minute call) |
| `/comment-writer` | Comment Writer | a comment on someone's post (text or screenshot), 6 tunes |
| `/post-comment-replies` | Post Comment Replies | a reply to one comment, 2 contexts × 6 tones (Show Expertise, Ask Their Opinion, Give Useful Tips, Share Real Example, Politely Disagree, Invite to DM), written as Abdul Rafay to the other person's latest comment |
| `/follow-up-message` | Follow-Up Message | a follow-up from a pasted conversation, 2 types |
| `/first-message` | First Message | a first DM from a profile, 5 tones (Curiosity Hook default) |
| `/inmail-message` | InMail Composer | subject + message from a profile, 4 tones (Trigger Event default) |
| `/conversation-reply` | Conversation Reply | analysis + next reply from a conversation, 6 tones (Validate + Share Pattern default) |

Alongside them are the modules that are not LinkedIn tools:

| Route | Module | What it does |
|---|---|---|
| `/prompt-creator` | Prompt Creator | Turns a spoken or typed description of a task into one ready-to-paste English prompt, for a coding agent (Cursor, Claude, Antigravity) or for AI web search (ChatGPT, Gemini) |
| `/meetings` | Meeting Minutes | Reads a whole meeting transcript, however long, and gives the participants, the purpose, Abdul's own tasks, the decisions, the action items and a 3 to 4 line summary to send the client |
| `/meeting-planner` | Meeting Planner | Schedules a meeting that has not happened yet (name, day, time, pending or completed) on a month calendar with today at the top, and optionally writes the preparation for it: a grounded read of the person, the topics worth covering and a nine-stage conversation plan |
| `/quick-notes` | Quick Notes | Saves text the user pastes or writes, lists it newest first, copies or deletes any note, and clears the lot after a confirmation. No AI runs on it |
| `/reference-content` | Reference Content | A searchable library of named, reusable text: the steps, procedures and explanations sent to clients again and again. Add, edit, copy, delete. No AI runs on it |
| `/client-messaging` | Client Messaging | Keeps each client's own message format and sample messages, then writes a formal update in that format for LinkedIn, Upwork, Fiverr, Slack, Discord, WhatsApp or email |
| `/message-rewriter` | Message Rewriter | Turns a spoken or typed message, in any language, into one short, clear English message that says what the user meant |
| `/client-voices` | Client Voices | Turns up to 15 client voice messages into one English transcript each, plus one list of the work the client asked for. Stores nothing |
| `/important-files` | Important Files | Keeps the images, PDFs, Word files, text files, videos and audio worth reusing, in S3, with search, type filters, preview, download and metadata editing |
| `/daily-tasks` | Daily Tasks | A day's checklist: several tasks written in one go for a chosen day, ticked off with a checkbox, the last seven days on screen and older days on their own pages. No AI runs on it |

`/` redirects to the first tool. There is no chat, knowledge base, analytics, inspector or auth. Those were removed on purpose, so don't reintroduce them.

**`src/constants/linkedinTools.ts` is the app's one navigation source.** It holds `TOOL_GROUPS`, the four sidebar headings, and two lists: `LINKEDIN_TOOLS` (the 9 LinkedIn tools, all in the `linkedin` group, the first of which is where `/` lands) and `APP_TOOLS` (those plus every other module, in sidebar order). `APP_TOOLS` alone drives the sidebar, the Jump to a tool switcher, the sitemap, the manifest shortcuts and `SEO_PAGES`, so a tool added there appears in all of them at once and can never exist in one surface and be missing from another. Never hand-write a second list of tools anywhere.

| Group | Heading | What belongs in it |
|---|---|---|
| `linkedin` | LinkedIn Tools | the 9 tools above: what to post and the image for it, then outreach, then engaging on posts, then conversations |
| `clients` | Client Work | the people the work is for: Client Messaging, Client Voices, Meeting Planner, Meeting Minutes |
| `writing` | Writing & Prompts | text for everything else: Prompt Creator, Message Rewriter |
| `workspace` | Workspace | what the day and the work are kept in: Daily Tasks, Quick Notes, Reference Content, Important Files |

A tool's `group` is a `ToolGroupId`, so a group that isn't one of these four fails the type check rather than quietly dropping the tool out of the sidebar. Keep the headings few: a new module joins one of them instead of adding a fifth. Global AI Prompts is not a tool and stays pinned below the groups.

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
- If `next dev` answers **every** route with the app's 404 page (API routes too, while files in `public/` still load), its `.next` cache is stale (it happened after `npm run build` ran while a dev server was up). Stop the dev server, delete `.next` and start it again; the code isn't the problem. Prefer running `npm run build` while no dev server is running.
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
| `MONGODB_URI` | **Required.** The `LinkPilot` database: every prompt, Trending history, Dummy Data and every tool's saved outputs (see Database). |
| `PROMPT_EDITOR_PASSWORD` | Password for every Update Prompt editor. If unset, prompt editing is locked for everyone. |
| `GOOGLE_API_KEY` + `GEMINI_LIGHTWEIGHT_MODEL` | **Primary** provider (Gemini), plus Google Search grounding for research. |
| `OPENAI_API_KEY` + `OPENAI_LIGHTWEIGHT_MODEL` | **Fallback** provider (GPT-4o Mini), plus OpenAI web search for research. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` | Important Files storage. Server-only, read in one place (`services/storage/s3.ts`). Without all four, that module says so and every other module carries on. |
| `OPENAI_IMAGE_MODEL` | The image model Post Image Creator draws with, through the OpenAI Images API on the same `OPENAI_API_KEY`, e.g. `gpt-image-1`. Without it that module says so and every other module carries on. |
| `OPENAI_TRANSCRIPTION_MODEL` | Reads recordings (voice input on Prompt Creator and Client Messaging) when Gemini can't, e.g. `gpt-4o-mini-transcribe`. Without it, voice input needs Gemini. |

Model names live **only** in env. Never hardcode a model id in code. Gemini 1.5 models are retired and return 404. The free Gemini tier has a small per-day request quota, and once it's used up every call falls back to OpenAI.

## AI architecture (`src/services/ai.ts`)

- `AI_PROVIDERS = ["gemini", "openai"]` is the full provider set. Don't add other providers (Grok/xAI, Anthropic, etc.).
- `createGeminiModel()` and `createOpenAIModel()` are the only places a LangChain chat model is constructed.
- `generateStructuredWithFallback({ schema, name, messages, validate?, providers?, onFallback?, timeoutMs?, signal? })` is how every tool generates. It tries Gemini first. If Gemini isn't configured, fails, times out (default 45s), returns output that fails the schema, or fails `validate`, it moves to OpenAI. It throws `UserFacingError` when no provider is configured. `onFallback` lets streaming tools show "switching to the backup model".
- **Retries (standard exponential backoff with full jitter, `lib/retry.ts` `withRetry`; only transient failures, `lib/transientErrors.ts` `isTransientError`: 408/425/429/5xx, dropped connections, Mongo network errors; never bad keys, 400s, used-up quotas, timeouts or aborts):**
  - AI calls: `withProviderRetry` retries a provider twice (research passes once) and honours `Retry-After` / Gemini's `retryDelay` (a wait over 8s isn't waited out), before the Gemini → OpenAI fallback. LangChain's own retries are off (`maxRetries: 0`) so they never stack.
  - MongoDB: `connectDB` retries the connection twice and never caches a failed one. Grounding-link resolving retries once.
  - Browser: every call goes through `fetchWithRetry` / `requestApi` (`lib/apiClient.ts`). GET/PUT/DELETE retry on network errors and 408/429/502/503/504. POST retries only with `{ retry: true }` (the generators and the three SSE tools, which only retry before the stream starts), never the password check or dummy-data create. A 500 is never retried.
- **Audio** is the one thing the chat models above don't share: Gemini reads a recording inside the chat model (an `audio` content block), and OpenAI reads it through its own transcription endpoint, `transcribeWithOpenAI` in `services/ai.ts` (`OPENAI_TRANSCRIPTION_MODEL`, same `withProviderRetry`). Voice input uses it (see Voice input).
- `services/senderGuard.ts` wraps it for outreach tools. It detects invented claims about the sender (the `SENDER_CLAIM` regex) and asks for one rewrite.
- Shared fabrication checks, each comparing the output against the tool's sources: `lib/figures.ts` (`findUnsupportedFigures`: a number + unit no source contains) and `services/userClaims.ts` (`findUnsupportedUserClaims`: sentences about the user's work the sources don't support; `findInventedProof`: case studies, "a similar company", "in half"). Post Comment Replies, Conversation Reply and Follow-Up use them to trigger a targeted rewrite and to validate the humanized text. Reuse them instead of writing new regexes.
- `services/liveResearch.ts` (`runLiveResearch`) handles web research for Trending Topics, Comment Writer and Post Comment Replies:
  - It tries Gemini with `{ googleSearch: {} }` grounding first. Only grounding chunks count as sources, and their Google redirect URIs are resolved to real URLs.
  - Both providers take a list of passes (`geminiPasses`, `openAIPasses`) that run in parallel and are merged; failed passes are skipped. Trending runs one pass per lens in the `trending-search-lenses` prompt (so 3 Gemini research calls + 1 synthesis call per search); Comment Writer and Post Comment Replies use a single Gemini pass.
  - It falls back to OpenAI Responses `tools.webSearch()`, running parallel passes with `tool_choice: "required"`.
- **Humanization (`services/humanizer.ts`, `humanizeTexts`) is the last step of all 8 tools, and of Message Rewriter.** Each tool passes its final, already-verified texts (note, message, InMail subject + message, reply, comment, Trending hooks + bodies) through the user's saved **Humanization** prompt from Global AI Prompts (prompt `global-humanization`, `{{text}}` = the drafts), under the fixed rules in the `humanizer-system` prompt.
  - One structured call per result, each text as a `<draft id=… kind=… max_chars=… one_line=… rule=…>`. Code judges every rewrite on its own: same numbers, links, hashtags and @mentions; no new sender claim or placeholder; within `maxChars`/one line; plus the tool's own `validate(id, text)` (comment checks, conversation-reply problem checks, post-reply experience claims, Trending word limits).
  - Failed texts get one targeted retry told exactly what broke (the backup provider takes over if that still fails); a text that never passes keeps its verified draft. Every tool logs `humanized`. New tools must humanize their output too.
  - **Human style (strict), all 8 tools:** no em/en dashes as pauses, no colons or semicolons, no AI words (seamless, robust, leverage, delve, elevate, unlock…). Every writing prompt (each tone/tune/type/style prompt, each `*-system`, `trending-topics`, `trending-synthesis`, `global-humanization`, `humanizer-system`) ends with a `HUMAN STYLE (STRICT, NEVER BREAK THIS)` block; keep it on new or rewritten prompts. Lead-signals, About Me, Rafay Profile Info and research prompts don't have it (not written copy). In code, `lib/humanStyle.ts` (`applyHumanStyle`) rewrites every draft and rewrite inside `humanizeTexts` (links, hashtags, @mentions, times, ratios, hyphens and number ranges are kept; single-line fields such as InMail subjects get a comma instead of a new sentence), and a rewrite that adds a word from `findAiWords` is sent back.
  - Prompt Creator and Client Messaging are the exceptions: they write prompts for other AI tools and formal client updates, so their output is not humanized. Message Rewriter does humanize, because what it produces is a message the user sends as their own.
  - Global AI Prompts page: `/global-prompts` (`constants/globalPrompts.ts`, `services/globalPrompts.ts`); Rafay Profile Info is Abdul's facts source for Post Comment Replies (with About Me).

## Architecture

### Page pattern
Each tool route has two parts:
- A thin server `page.tsx` that holds only metadata and JSON-LD.
- A `"use client"` `*Client.tsx` that composes `Sidebar` and `Header` from `src/components/ui/`. Sidebar collapse state comes from `hooks/useSidebarCollapse` (localStorage key `isSidebarCollapsed`; Ctrl/⌘+B toggles it on desktop).
  - **Sidebar:** brand row (`SITE_LOGO_PNG` mark + "LinkPilot" + AI pill) as tall as the header; tools listed under the four `TOOL_GROUPS` headings (each tool's `group` in `constants/linkedinTools.ts`); Global AI Prompts pinned at the bottom. **A row is one line, the tool's name only:** with 19 tools a second line of description per row is noise, so the description is the row's `title` tooltip, the rail tooltip when collapsed, and the second line in the switcher. The whole list fits a 900px screen without scrolling; keep it that way. The current tool gets a filled icon tile and a left accent bar. Each group is a `<section>` labelled by its `<h2>` heading. Collapsed on desktop it's a 76px icon rail with a custom tooltip (name + description or activity), with a hairline in place of each heading; the mobile drawer (`z-[45]`) always shows the full list. No per-link "open in new tab" arrow.
  - **Header:** `SITE_PURPOSE` ("Outreach & Client Workspace", `config/site.ts`; it names the whole app, not only the LinkedIn tools, and is also the home page's title and social-card heading), the background-activity indicator and a "Jump to a tool" search (`components/ui/ToolSwitcher`, also Ctrl/⌘+K). The switcher reads `APP_TOOLS` plus Global AI Prompts, shows each tool's sidebar heading beside its description, and searches the heading too, so typing "client work" finds that whole group. No user/profile or AI-status badge.
  - **Background activity (`lib/toolActivity.ts`):** result stores pass `activity: { href, statusOf }` to `createToolStore`; a run shows as a spinner on its sidebar item and "X is writing" in the header (`components/ui/ActivityIndicator`) while the user is on another page, then a dot / "X is ready" (or "didn't finish") until that tool is opened. New result stores must pass `activity` too.

### Tool state survives switching tools (`lib/toolStore.ts`)
- Never keep a tool's inputs or results in component `useState`: leaving the page would lose them. Each tool has module-level stores made with `createToolStore(name, initial, { version, toStored })`, read with `useToolStore` (`useSyncExternalStore`): a `<tool>:form` store in its `*Client.tsx` and a `<tool>:result` store for the generation (`createGenerationRequest` in `hooks/useGenerationRequest.ts` for JSON tools; `useCommentGenerator`, `usePostCommentReplyGenerator`, `useTrendingTopicsSearch` for the streaming ones).
- Requests are never aborted on unmount, so a generation started before switching tools finishes into the store; only a newer request or Reset cancels it (and a cancelled request never writes).
- **Each browser tab keeps its own state.** Stores save to the tab's `sessionStorage` (`linkpilot:tool:<name>`) and also mirror to `localStorage` for 24h after the last change.
  - A tab always restores its own copy first, so the same tool open in several tabs never shows another tab's input or result, even after the browser reloads a background tab or the dev server hot-reloads.
  - Only a brand-new tab starts from the `localStorage` copy (the latest from any tab). Reset writes the empty state to the tab's own copy.
  - Never add `storage` event listeners or other cross-tab syncing to tool stores.
- `toStored` keeps uploaded `File`s (memory only) and unfinished requests out of storage. Bump `version` when a store's shape changes.
- Trending Topics loads the shared saved topics once per page load (a new tab or a refresh), not when a tab comes back into view.
- Every tool header has `components/ui/ResetButton` next to Update Prompt: it clears the pasted/uploaded data and the result, and keeps the chosen tone/tune/type/style/context.

Styling is Tailwind with Material-3 color tokens from `tailwind.config.ts` (`bg-surface-container`, `text-on-surface-variant`, `bg-primary-container`, …). Use those tokens, not raw colors. The app is light theme only.
- The scheme is **Signal Violet & Gold** (it replaced the original teal, blue-tinted surfaces and orange):
  - Brand violet: `primary` #5b21b6, hover `on-primary-fixed-variant` #4c1d95, selected `primary-container` #6d28d9 with `on-primary-container` #ede9fe, light tags `primary-fixed` #ddd6fe. Button hovers use `hover:bg-on-primary-fixed-variant`.
  - Gold accent (`secondary*`, amber): Hot/Warm tags, warnings, moderate score bars.
  - Green (`success`, `on-success`, `success-container`, `on-success-container`): a finished thing, currently a ticked Daily Task. It is a state colour, never a brand accent.
  - Neutrals are violet-tinted porcelain: `background` #f7f6fa (use `bg-background`, never a hex), ink `on-surface` #1c1826, `on-surface-variant` #4a4658, `outline` #686477 (keeps small labels ≥4.5:1 even on hover fills), hairline `outline-variant` #d6d2df. `shadow-sm/lg/xl` are overridden with soft ink-tinted shadows.
  - Colors outside the tokens: `globals.css` (body, selection, scrollbar), `SITE_THEME_COLOR` / `SITE_BACKGROUND_COLOR` in `config/site.ts` (manifest, viewport) and the social cards in `app/og/[slug]`.
- The logo is `public/linkpilot-mark.svg` (source and favicon) and its 512px render `public/linkpilot-mark.png`: a violet gradient tile with a white guiding star and a gold spark. Reference them only through `SITE_LOGO_SVG` / `SITE_LOGO_PNG` in `config/site.ts`.

### Branding, icons and link previews
- **Icons:** every icon in `public/` is generated from `linkpilot-mark.svg` by `npm run brand:icons` (`scripts/generate-brand-icons.mjs`, sharp): `favicon.ico` (16/32/48), `favicon-{16,32,48}x….png`, `favicon.png` (96), `icon-{48…512}.png`, opaque full-bleed `apple-touch-icon[-180x180].png` (iOS paints transparency black), `maskable-icon[-512x512].png` (glyph inside the 80% safe zone), `monochrome-icon.png` and `safari-pinned-tab.svg`. Rerun it whenever the mark changes; never hand-edit them. `BRAND_ICONS` in `config/site.ts` lists them for the layout and manifest.
- **Metadata:** the root layout sets `metadataBase` (`NEXT_PUBLIC_BASE_URL`), the `%s | LinkPilot AI` title template, icons, `appleWebApp` and `viewport` (theme colour). Each page's `metadata` is `pageMetadata("<slug>")` (`lib/metadata.ts`) built from its entry in `constants/seo.ts` (`SEO_PAGES`: title, description, card heading, indexable): canonical, `og:url`/title/description and its own card. A new page needs an `SEO_PAGES` entry. `TWITTER_HANDLE` (optional env) adds `twitter:site`/`creator`.
- **Link preview cards:** `app/og/[slug]/route.tsx` renders `/og/<slug>.png` (1200×630, ~130 KB, logo + page title centred for WhatsApp's square crop, Inter from `src/assets/fonts`), prerendered at build. Unknown slugs get the home card; a render failure returns the logo.
- **Manifest:** `app/manifest.ts` (`/manifest.webmanifest`; `/manifest.json` and `/site.webmanifest` rewrite to it) with any/maskable/monochrome icons and a shortcut per tool.
- **Headers (`next.config.ts`):** no `X-Powered-By`; nosniff, Referrer-Policy, Permissions-Policy, no framing; HSTS in production only; brand icons cached for 7 days. `/` is a 308 to the first tool.

### Layers
- `src/app/api/<tool>/generate` and `…/prompts[/<id>]`: route handlers. They Zod-validate input and return `{ success, message, data }`. Dynamic `params` is a `Promise` and must be awaited.
  - Research-heavy tools (Trending Topics, Comment Writer, Post Comment Replies) stream Server-Sent Events via `lib/sse.ts`: `{status, text}` stages, then `COMPLETE` with the result or `ERROR`.
  - The other tools return JSON.
- `src/services/<tool>/`: generation logic per tool. Shared services:
  - `promptComposer` inserts `{{variable}}` placeholders into the template, or appends the data when the placeholder is missing, and strips data tags from untrusted input.
  - `promptStore` and `prompts` load templates from the database.
  - `senderProfile` and `senderContext` provide the About Me profile.
  - `postImage` extracts post text from screenshots.
  - `outreachPrompts` is the prompt factory for First Message and InMail.
  - `generationRecords` saves every tool's output (see Database).
- `src/constants/`: tool option lists (tones, tunes, styles), LinkedIn character limits and user-facing messages.
- `src/models/`: the Mongoose models, one per collection (see Database).

### Database (MongoDB `LinkPilot`, the only store; there are no prompt or data files)
Every collection has `createdAt` / `updatedAt` (Mongoose `timestamps`) and an explicit collection name.
- `prompts` (`models/Prompt.ts`): every prompt the app uses, one document per template. `key` is the template name (`PromptName` in `services/prompts.ts`, e.g. `connection-note-warm`, `global-humanization`, `sender-profile`), plus `tool`, `editable`, `content` (the text tools use) and `defaultContent` (the original).
  - `loadPrompt(name)` (async) reads `content`, cached 60s per server process; saving clears that key. A missing key throws `PromptTemplateMissing`. Keep prompts in this collection, never in code.
  - `getStoredPrompts(names)` returns `EditablePrompt`s (`isCustom` = content differs from the default) in one query, always fresh. `saveStoredPrompt(name, text)` only accepts `editable: true` prompts; saving the default text restores the default.
  - The 20 system prompts (`*-system`, research and analysis prompts, lenses, `conversation-reading`, `post-image-extraction`, `post-comment-reply-context-*`) are `editable: false` and change only in the database.
  - A new prompt means a new document in `prompts` plus its name in `PromptName`.
- `prompt_revisions` (`models/PromptRevision.ts`): the text a prompt had before each save (`promptKey`, `content`), so an overwritten prompt can be recovered.
- `trending_searches` (`models/TrendingSearch.ts`): every search ever run (`result`, `topicCount`, `searchProvider`, `searchedAt`, `dismissedAt`). Never deleted.
- `dummy_data` (`models/DummyItem.ts`): Dummy Data items (`kind`, `slug` = the id, `name`, `fields`), unique on kind + slug.
- `clients` (`models/Client.ts`): the people Client Messaging writes to (`name`, `country`, `messageFormat`, `sampleMessages`).
- `meeting_plans` (`models/MeetingPlan.ts`): Meeting Planner meetings (`name`, `meetingDate` YYYY-MM-DD, `meetingTime` HH:mm, `status`, `completedAt`, `personName`, `prepEnabled`, the three preparation inputs, `prepStatus`, `prepError`, `prep`, `preparedAt`), indexed `{ meetingDate: 1, meetingTime: 1, _id: 1 }` for the calendar and `{ status: 1, meetingDate: 1 }` for the pending count. Nothing to do with the `meetings` collection, which holds transcripts.
- `daily_tasks` (`models/DailyTask.ts`): Daily Tasks (`content`, `taskDate` as YYYY-MM-DD, `isCompleted`, `completedAt`), indexed `{ taskDate: -1, createdAt: 1, _id: 1 }` for the newest-first list and the bulk cleanup, and `{ isCompleted: 1, taskDate: -1 }` for the overdue count.
- `meetings` (`models/Meeting.ts`): one meeting, with the transcript exactly as pasted kept apart from the analysis built from it, plus `transcriptHash` / `analyzedHash` (which tell a stale analysis from a current one), the status and the chunk counters. Indexed `{ createdAt: -1, _id: -1 }` for the history, `{ status: 1, createdAt: -1, _id: -1 }` for the status filter and `{ title: 1 }` for the search.
- `meeting_chunks` (`models/MeetingChunk.ts`): what one part of one transcript gave up, written the moment it is read, unique on (meeting, transcript, part). This is what makes an analysis resumable and a retry cheap.
- `reference_content` (`models/ReferenceItem.ts`): the Reference Content library (`title`, `content` plus timestamps), indexed `{ createdAt: -1, _id: -1 }` for its cursor paging.
- `quick_notes` (`models/QuickNote.ts`): text saved in Quick Notes (`content` plus the timestamps), indexed `{ createdAt: -1, _id: -1 }` so newest-first stays stable when two notes share a millisecond.
- `created_prompts` (`models/CreatedPrompt.ts`): every prompt the Prompt Creator wrote (`name`, `prompt`, `target`, `request`, `requestSource`, `provider`, `editedAt`), including the user's later edits.
- One collection per tool for its outputs (`models/GenerationRecords.ts`, saved by `services/generationRecords.ts` from each generate route): `connection_notes`, `comment_writer_comments`, `post_comment_replies`, `follow_up_messages`, `first_messages`, `inmail_messages`, `conversation_replies`, `client_messages`, `rewritten_messages`.
- `post_image_settings` and `post_images` (`models/PostImage.ts`): the brand defaults (one document, found by a fixed `scope`, holding the display name, the colours and the saved photos) and one document per generated image. An image's document **copies** the settings it was made with rather than pointing at them.
- `important_files` (`models/AssetFile.ts`): what the app knows about each stored file (the name the user gave it, description, original name, content type, category, size, its S3 key and `status`). The file itself is in S3, never in Mongo. Each holds the inputs, the choice (tone/tune/type/style/context), the main text, and the full `result`. Profile and conversation tools also store `lead` { name, headline, company } (`lib/leadInfo.ts`: from the pasted profile, else the conversation's sender lines, else the analysis). A record that fails to save is logged and never fails the response. New tools must save their outputs too.
- `connectDatabase()` (`lib/db.ts`) turns a failed connection into a `UserFacingError`. Mongoose types stay flat: store nested results as `Schema.Types.Mixed` typed `unknown`, and give each schema its own `new Schema<IRecord>(…)`. Typing a Mixed field with a deep interface, or building schemas from a spread definition, makes `tsc` run out of memory.

### Editable prompts
- Every tone, tune or style has its **own independent prompt**, its own document in `prompts`.
- **About Me** (the `sender-profile` prompt, edited from First Message or InMail → Update Prompt → About Me) is the only source of facts about the user. Tools must never claim experience it doesn't contain, and while it's still the unfilled template, tools treat it as empty.
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

### Editable results (every tool)
- Every generated text (connection note, comment, post reply, follow-up, first message, InMail subject + message, conversation reply, Trending post) shows in `components/ui/EditableOutput`:
  - it's edited in place, and a Bold button or Ctrl/⌘+B toggles LinkedIn bold on the selection;
  - "Undo changes" restores the generated text;
  - Copy, the character count and over-limit colouring all use the edited text.
- LinkedIn has no formatting, so bold is Unicode Mathematical Sans-Serif Bold (`lib/linkedinBold.ts`). Links, #hashtags and @mentions are never converted. Each bold letter is 2 UTF-16 characters, and counts use `value.length`.
- Edits live in one tool store (`lib/outputEdits.ts`, `useEditableText(scope, generatedText)`), keyed by tool and the generated text. They survive switching tools and refreshes, a new generation starts clean, and the oldest edits are pruned after 60. A new result view must use `useEditableText` + `EditableOutput` and copy `value`.
- The header's Ctrl/⌘+B (sidebar) is ignored inside text fields, so it means Bold there.

### Prompt password (`services/promptAccess.ts`, no database)
- Both editor bases (`PromptTabsModal`, `ReplyPromptsModal`) render inside `PromptAccessGate`. The editor mounts, and loads prompts, only after `GET /api/prompt-access` reports `unlocked`.
- `POST /api/prompt-access` checks the password against env:
  - A correct password sets a signed httpOnly `lp_prompt_session` cookie, valid 48h, that covers every tool.
  - Each wrong password is counted in a signed `lp_prompt_attempts` cookie. The 3rd locks that browser for 24h, and while locked even the correct password is refused.
  - Cookies are HMAC-signed with a key derived from the password, so changing the password ends every session.
- Every prompt API handler (all `…/prompts` routes and `trending-topics/prompt`, GET and PUT) starts with `requirePromptAccess()`. New prompt routes must too. Generation routes stay open.
- This is intentionally light security: clearing cookies resets the attempt counter.

### Lead Signals (Follow-Up Message, Conversation Reply)
- One shared 16-row table (`components/lead-signals/LeadSignalsTable`, row order = the owner's chosen order), service (`services/leadSignals.ts`, `assessLeadSignalsSafely` runs alongside the main generation and returns null instead of failing it), types (`types/leadSignals.ts`), label options (`constants/leadSignals.ts`) and fixed rules (the `lead-signals-system` prompt).
- Each tool keeps its **own** editable "Lead Signals" prompt tab (`follow-up-lead-signals` / `conversation-reply-lead-signals`), so editing one never changes the other. The signals never see the chosen type or tone.

### Dummy Data (every tool with an input)
- `constants/dummyData.ts` (`DUMMY_DATA_KINDS`) registers each kind and its fields (key, label, limit = the input it fills, required):
  - `profiles` (profile), shared by Connection Note, First Message and InMail
  - `posts` (post), Comment Writer
  - `comment-threads` (post optional + comments), Post Comment Replies
  - `follow-up-conversations` (conversation + optional profile), Follow-Up
  - `reply-conversations` (conversation + optional profile), Conversation Reply
  - `messages-to-rewrite` (message), Message Rewriter
  - Trending Topics has no input, so no kind. Adding a kind = a registry entry.
- Items live in the `dummy_data` collection. `services/dummyData.ts` reads and writes them: the id is a slug of the name (`DUMMY_ITEM_ID_PATTERN`, a number added when taken, never overwriting thanks to the unique index), and only the kind's own fields are kept, trimmed. Items list oldest first.
- `GET/POST /api/dummy-data/[kind]` and `PUT/DELETE /api/dummy-data/[kind]/[id]` (body `{ name, fields }`) all start with `requirePromptAccess()`.
- `components/dummy-data/DummyDataModal` (`kind` prop, behind `PromptAccessGate`) edits items like prompts (one tab each, add, two-step delete, auto-close after save), with a Copy button per field. **Use this …** passes all fields to the tool's `onUse`, which fills its inputs, clears the previous result and closes the popup. `DummyDataButton` sits in each tool header.
- Sample conversations use LinkedIn-style "Name  date" sender lines with the owner as Abdul Rafay; all seed items are fictional.

### Post Comment Replies
- Replies are written as `REPLY_AUTHOR_NAME` (Abdul Rafay). There is no comment picker: `resolveTargetComment` always answers the latest parsed comment not written by him (`isReplyAuthor`); his own comments are context only.
- Style prompts can place `{{conversation}}`, `{{post_content}}`, `{{latest_comment}}` / `{{comment}}` (the comment being answered), `{{sender_profile}}` and `{{web_research}}`; anything not placed is appended, without repeating placed parts.
- `<sender_profile>` is always included: About Me plus Rafay Profile Info (Global AI Prompts). It is the only source of facts, numbers and projects about Abdul; contact details from it never go into a reply.
- Replies are short and plain: at most `REPLY_TARGET_MAX_CHARS` (280, aim 200–270) and no colons, semicolons, dashes or commas (commas inside numbers are fine). The system prompt, every style prompt and the humanizer's `maxChars`/`rule` all enforce it.
- After the first draft, code checks for unsupported experience claims, unnamed client stories, figures (number + unit, in digits or words, "percent" = "%") that appear in none of the sources (profile, post, comments, style prompt), replies over 280 characters and stiff punctuation (`STIFF_PUNCTUATION`), and runs up to `MAX_REWRITES` targeted rewrites, keeping the cleanest version. Markdown marks are stripped.

### Connection Note
- A tone prompt that places `{{sender_profile}}` gets the user's own profile (`getFullSenderProfile` in `services/senderProfile.ts`: About Me + Rafay Profile Info, also used by Post Comment Replies); other tones get nothing about the sender. Recently Funded and Hiring Startup are the defaults that use it. Their prompts start with "STEP 1. STUDY BOTH PROFILES": the model first writes `recipient_need` (what the recipient's company needs) and `my_best_match` (the user's closest project, in the profile's words) via `FitNoteSchema`, then the note around that match; both fields are logged with "Connection note generated". Tones without `{{sender_profile}}` keep the note-only `NoteSchema`.
- A link may appear in a note only when the tone prompt itself gives it (Recently Funded and Hiring Startup give the portfolio, https://rafaydev.vercel.app): a note that adds another link, or leaves out the given one, is rewritten.
- **Company tones** (`COMPANY_TONES` in `constants/connectionNote.ts`: Recently Funded = funding, Hiring Startup = hiring):
  - The page shows a Company name field (`companyName` in the form store and the API, max 100), placed in the prompt as `{{company_name}}`.
  - A named company is taken as the one with that news even when the pasted profile doesn't mention it, so the funding or hiring check lets it through. Details (round, amount, role) still come only from the profile. The note must name the company.
  - Notes in these tones must open with "Hi" and the first name ("Hi Sara congratulations…"); code checks `OPENS_WITH_HI`. The other four tones are unchanged.
- Notes are sent from the owner's account (`SITE_AUTHOR`, Abdul Rafay): both new tone prompts say so, the name in the note is always the recipient's, and code rewrites a note that contains the owner's full name or signs off with his first name (a recipient may also be called Abdul, so a leading "Abdul" is fine).
- After the first draft, code checks the note and runs up to 2 targeted rewrites (cleanest version wins). It checks for:
  - stock openers and a comma or full stop after the name;
  - funding or hiring (including "building/growing the team") the pasted profile never mentions (`PROFILE_ONLY_NEWS`);
  - going over 300 characters;
  - figures no source contains;
  - claims about the user's work that their own profile doesn't support (`findUnsupportedUserClaims`), and invented proof;
  - the recipient's numbers claimed as the user's (any number in an "I/my" sentence must be in the user's own words: their profile or the tone prompt);
  - the recipient's funding or hiring news told as the user's own ("I have some big news about raising…");
  - the user's work reshaped to mirror the recipient's product: a distinctive word from their profile, absent from the user's, in a sentence about the user's work ("I have built AI scheduling systems" to a scheduling startup).
- Claims about the user's work are checked against the sender profile only (not the tone prompt, whose examples would make anything look supported). The humanized note is rejected if it has more problems than its draft, so the last rewrite can't bring any of them back.
- Last resorts: a sentence that still borrows the recipient's numbers is dropped, and a note still over 300 characters loses its shortest middle sentence that brings it under (never the opening, the closing ask or the sentence with the link).

### Trending Topics
- The brief (the `trending-topics` prompt) targets the owner's domain: web development, AI, and SaaS/MVPs for founders. Mobile apps and consumer hardware are excluded.
- **Shared saved topics (`services/trending/savedTopics.ts`):** every search is added to `trending_searches` and kept forever. Everyone sees the newest search that found topics and hasn't been dismissed; its `result` is Zod-validated on read. A search with no topics is kept in the history but leaves the previous topics on show. `GET /api/trending-topics/saved` returns `{ result }` (the page loads it once per page load), and `DELETE` (Reset) sets `dismissedAt` on the searches on show, hiding them for everyone without deleting anything.
- **The post is built for reach, not for a news summary.** The rules below are enforced in prompts *and* in code, because the model drifts from every one of them:
  - `TRENDING_POST_FORMATS` (`constants/trending.ts`) holds the 6 formats (contrarian, story, playbook, numbers, myth, prediction). The synthesis prompt assigns one per rank and `finalize.ts` guarantees the published set never repeats one, so six posts never read alike. A topic whose format had to be changed is listed in `reshape` and its body is rebuilt into the new shape.
  - **No link anywhere in the post**, and none in its first comment either: LinkedIn shows a post carrying an external link to far fewer people. `composeTrendingPost` assembles hook, body, closing line and hashtags only, and the source stays beside the post in the app.
  - `POST_TARGET_MIN_CHARS`–`POST_TARGET_MAX_CHARS` (1200–2000) is the length that travels, the hook is one line of at most `POST_HOOK_MAX_WORDS` (12) words, at most one hook in the set is a question, and the post ends on one specific question, because comments are what carry it outside the network. 3 to 5 hashtags, at the end only.
  - `services/trending/expand.ts` is the repair step. It rewrites **one post per call, a few in parallel** (asked for six long bodies at once, a model writes six short ones), for any post that is short, ends on a generic question, repeats another hook's opening word, carries an AI word or a stock phrase, talks about LinkedIn itself, or needs its format rebuilt. A rewrite is kept only when it is measurably better. It runs before the humanizer and again after it, because rewriting for tone can shorten a post or bring a stock phrase back.
  - The synthesis step is asked for `TRENDING_CANDIDATE_COUNT` (6 + 2 spares) so that a duplicate or an unverifiable source no longer leaves the page short, and `TRENDING_TOPIC_COUNT` (6) still caps what is published.
- Verification is deliberately strict and the notice says what it dropped: a reference URL must be one the live search returned (matched by page, not by spelling), and `lib/eventDate.ts` accepts an event date only when the research text or a source URL states it. Topics whose hook or body still contain a `[placeholder]` are rejected.


### Client Voices (`/client-voices`, not a LinkedIn tool)
- The voice messages a client sends on WhatsApp or Slack, in one batch of up to `VOICE_BATCH_MAX` (15). Each one comes back as its own English transcript, in the order it was added, and the batch comes down to **one** list of what the client asked for, never one list per voice.
- **Nothing is stored.** No model, no collection, no record, no upload to S3, no temporary object, nothing kept on the server between requests. The audio goes from the browser to the transcription provider as the body of its own request, the transcripts live in the page, and closing the page is what deletes the batch. The one thing that is saved is the editable prompt, like every other module.
- **S3 is not used and is not needed here**, because the provider takes the audio directly (`services/transcribeAudio.ts`). The bucket in Important Files is for files the user chose to keep; a client's voice is not one of them.
- **One request per voice**, run `TRANSCRIBE_CONCURRENCY` (3) at a time from the browser (`lib/voiceBatch.ts`). That is what makes it work on Vercel: a function takes a 4.5 MB body, so `VOICE_MAX_BYTES` is 4 MB per voice and fifteen voices never share a request or a time limit. It also means a failure belongs to one voice, which is what lets that one be tried again while the transcripts that worked stay on screen.
- Transcription is the shared endpoint `/api/transcribe` (see Voice input). This module adds no transcription code of its own.
- **Every voice always has a state**: ready, queued, transcribing, done or failed. A failed voice keeps its place with the reason and a "Try this one again" button, the page says "8 of 8 voices written out" or "2 of 3, 1 failed", and the task list says which voices it was made without. A voice is never quietly dropped.
- **Pasting is the point.** The page listens for a paste anywhere on it and takes the audio out of the clipboard, and the Paste voice button reads the clipboard where the browser allows it. When the clipboard holds a link rather than audio, which is what several apps copy, it says so and points at dropping the file instead of pretending a voice arrived.
- `POST /api/client-voices/tasks` takes only the transcripts and the numbers of the voices that failed. `services/clientVoices/tasks.ts` writes the list under the editable `client-voice-tasks` prompt and the fixed `client-voice-tasks-system` rules: one task per distinct request, a request made in several voices merged into one task carrying every voice number and every detail from all of them, a later voice that changes an earlier request replacing it, and context, thanks and what the client said they would do themselves left out. A voice number the model invents is dropped, because it would put a task against a voice the client never sent.
- Copy All Tasks copies the tasks as plain lines and nothing else, no voice labels and nothing from the page.

### Post Image Creator (`/post-image-creator`)
- Two halves. **Default Settings** (a dialog) holds the name that goes on a post, up to `MAX_BRAND_COLORS` (8) hex colours and up to `MAX_BRAND_ASSETS` (12) named photos. **New image** starts from those defaults, takes the post content, zero or one photo, a pose and a shape, and draws the picture. `/post-image-creator/history` is the gallery of everything made.
- **Drawing is `services/imageGeneration.ts`**, the only place that asks for an image. It is the OpenAI Images API on the same key as the chat models, with the model name from `OPENAI_IMAGE_MODEL` and never in code. With a photo it calls `images.edit` with that photo attached, which is what keeps the person recognisable, and asks for `input_fidelity: "high"`; a model that refuses that parameter is asked again without it rather than failing.
- **The instructions are built server side** (`services/postImages/generate.ts`): the fixed rules in the `post-image-system` prompt wrap the editable `post-image` prompt, and the runtime context (colours, name, post content, the pose's own instruction, the shape) is placed into both by name. The finished text is what the model gets **and** what is stored on the record, so an image can always be read back against the words that made it.
- **Two rules the app will not let an edit remove**: only the saved colours may be used for anything designed, while a photographed person keeps their own skin, hair and face (never recoloured to match a palette); and when no photo is attached the image contains no people at all, invented or otherwise.
- **History is a copy, not a pointer.** Each `post_images` document holds the colours, name, photo name, pose, shape, model and prompt as they were at the time. Changing the defaults afterwards, or the prompt, never rewrites an older image. A photo removed from the defaults keeps its object in S3, because images already made still name it.
- Storage is the shared `services/storage/s3.ts` under `LinkPilot/post-images/` (and `/assets/` for the brand photos). Brand photos go straight from the browser to S3 through a signed link; the generated image is made on the server and put there with `putObject`. Nothing is public: every preview and download is a short-lived signed link.
- **Nothing is written until the image exists.** The record is created after the image is stored, and a record that fails to write takes its object back out, so there is never a post with no picture or a picture nothing points at.
- Copy puts the PNG itself on the clipboard, handing the fetch to `ClipboardItem` so a megabyte of image does not outlive the click's permission, and a browser that refuses says so instead of looking as if it worked.
- **Drawing takes 35 to 130 seconds**, so `maxDuration` on the generate route is 300. That fits a Vercel Pro function; on Hobby, where the ceiling is 60 seconds, a generation with a photo will time out.

### Important Files (`/important-files`, not a LinkedIn tool)
- The images, PDFs, Word files, text files, videos and audio the user keeps to hand. Each one has a **name they choose**, which has nothing to do with the file name, and an optional description. `constants/importantFiles.ts` is the single mapping from a content type to a category (image, pdf, word, text, video, audio), and both the type filters and the server-side validation read it, so a type the app cannot place is a type it does not accept.
- **Storage is S3, and the app never carries the bytes.** `services/storage/s3.ts` is the only place the AWS credentials are read. The browser uploads straight to S3 with links signed there: one PUT under `MULTIPART_THRESHOLD_BYTES` (4 MB, which is also Vercel's request body ceiling), and a presigned multipart upload above it, in `UPLOAD_PART_BYTES` (8 MB) parts. A 500 MB video is 63 parts and never touches a serverless function.
- **Limits per category**, enforced on the server before anything is stored and again against S3 afterwards: video 500 MB, audio 200 MB, PDF and Word 100 MB, images and text 25 MB.
- **The record comes first, the file second.** `planUpload` writes the record as `status: "uploading"`, and only `finishUpload` (after `CompleteMultipartUpload` and a `HeadObject` that confirms what S3 really holds) makes it `ready`. Lists only ever show `ready`, so an interrupted upload can never look like a file you can open. A cancelled or failed upload calls `DELETE /api/important-files/uploads/[id]`, which aborts the multipart upload and drops the record.
- **The key is always built by the server** (`buildStorageKey`: the record's own id plus a cleaned file name, under `LinkPilot/important-files/`), never taken from the browser, so nothing can point an upload at another key or walk out of the prefix.
- **Nothing is public.** The bucket stays private and every preview or download is a signed link that expires in `SIGNED_URL_TTL_SECONDS` (15 minutes). A signed link names the key and the access key id, as every SigV4 URL does; the secret never leaves the server.
- **Paging, search and filters are the same shape as Reference Content**: a cursor of `createdAt|_id`, `ASSET_PAGE_SIZE` (24) capped in the service, search on the name as plain text (the pattern is escaped), and the category filter in the same query so paging keeps working inside a search.
- **Copy is offered only where it works**: the text of a text file, and a PNG through the Clipboard API. Video, audio, PDF and Word show no Copy button rather than one that fails (`canCopy` in `components/important-files/AssetGrid.tsx`).
- Editing changes the name and description only; `updateAssetMetadata` never touches the object. Deleting removes the object first and the record second, so a storage failure leaves the record rather than losing track of a stored file.
- The bucket needs a CORS rule allowing PUT, GET and HEAD from the app origin, with `ETag` exposed. Without it the browser cannot upload at all.

### Voice input (shared)
- One recorder, one endpoint, one set of messages, used by Prompt Creator and Client Messaging. A new module only renders the button.
- `components/ui/VoiceRecorder` records with `MediaRecorder` (it picks the first format the browser supports, stops itself at `VOICE_MAX_SECONDS` and always releases the microphone), posts to `/api/transcribe` and hands the text back through `onTranscript`; the page appends it to whatever is already typed. `what` sets the wording, for example `what="what you want to tell them"`. The button renders on the server and removes itself in a browser that cannot record.
- `constants/voiceInput.ts` holds `VOICE_MAX_BYTES`, `VOICE_MAX_SECONDS`, `TRANSCRIBE_ENDPOINT` and `VOICE_MESSAGES` (every microphone, recording and transcription message). Keep the wording free of any one page's subject, since all of them show it.
- `lib/audioType.ts` reads the container from the file's own bytes (wav, ogg, webm, mp4, mp3, flac), never from the browser's MIME type. `services/transcribeAudio.ts` (`transcribeRecording`) tries Gemini first, under the `prompt-creator-transcription` prompt, and falls back to OpenAI's transcription model whenever Gemini is unconfigured, fails, is out of quota or heard nothing, so speaking keeps working with either provider.
- The route answers 400 for a recording nobody can make out and 503 when neither provider is configured. The microphone needs `microphone=(self)` in the `Permissions-Policy` header (`next.config.ts`).

### Message Rewriter (`/message-rewriter`, not a LinkedIn tool)
- One message in, one message out: the user types, pastes or speaks a message in any language, and gets back a short, clear English message that says what they meant, which they edit in place and copy.
- It takes its input the same way Prompt Creator does, so it reuses the same pieces rather than its own: the shared recorder (see Voice input), `MESSAGE_MAX_LENGTH`, which **is** `REQUEST_MAX_LENGTH` (8000), and the Dummy Data kind `messages-to-rewrite`. Speaking several times adds to what is already typed.
- **One overall prompt** (`message-rewriter`, editable from Update Prompt) rewrites every message, under the fixed rules in `message-rewriter-system`. It places `{{message}}` and `{{max_chars}}`; anything it does not place is appended. The original is untrusted text inside its own delimiter tags, so an instruction written inside a message is rewritten like the rest of it, never followed.
- **Shorter is the point, meaning comes first.** `rewrittenMaxChars` caps the rewrite at the original's length, and a message under `SHORT_MESSAGE_ROOM` (280) may grow up to it, because a note such as "mtg 3pm cancel" only becomes clear as a sentence. A draft over the cap is sent back once to be cut down, and the shorter of the two wins. Nothing is added that the user did not say, and `findPlaceholders` throws out a draft with a slot the model invented.
- **The result is humanized** (`services/humanizer.ts`), like every LinkedIn tool and unlike the other two modules, with `maxChars` set just above the draft so the rewrite may reword but not grow. `humanized` is false when the humanizer's rewrite broke a check and the verified draft is what the user sees.
- `sourceLanguage` is the model's reading of the original ("Urdu"), shown on the result as "translated from ..." when it is not English.
- Inline editing is the shared `EditableOutput` + `useEditableText` pattern, so Copy always takes the edited text. Every rewrite is saved to `rewritten_messages` through `recordRewrittenMessage`, and a record that fails to save never fails the response. What the user wrote is never written to the log, only lengths, the language and the provider.

### Prompt Creator (`/prompt-creator`, not a LinkedIn tool)
- Describe a task by typing or by speaking, pick a target, and the module writes one complete English prompt for that target plus a 4 to 5 word name for it. `services/promptCreator/generate.ts` runs it through the usual `generateStructuredWithFallback` (name first, then the prompt, so the model settles the subject before writing), at a low temperature, and strips a code fence or a trailing full stop the model may add.
- Targets (`constants/promptCreator.ts` `PROMPT_TARGETS`, one editable prompt each): `editor-agent` (Cursor, Claude, Antigravity: TASK, CONTEXT, STEPS, CONSTRAINTS, VALIDATE, DONE WHEN, so the agent checks its own work) and `web-search` (ChatGPT, Gemini: GOAL, SEARCH, SOURCES, ANSWER, CHECK). The description is placed at `{{request}}`, inside `task_request` tags, and is data, never instructions. Adding a target = an entry here plus its `prompt-creator-<id>` record.
- **Voice input** is the shared recorder (see Voice input). It adds what was said to the description, and `requestSource` records whether the description was typed or spoken.
- Every created prompt is saved to `created_prompts` as part of the result, because the page needs its id: the name is renamed in place and the prompt text edited in place, and both are saved back to that record through `PUT /api/prompt-creator/created/[id]` (typing settles for ~1s first). `CreatedPromptPanel` is mounted under the record id, so a new prompt starts it fresh.
- Its output is a prompt for another AI, not LinkedIn copy, so it does not run through the humanizer and its prompts carry no HUMAN STYLE block.
- Dummy Data kind `prompt-requests` (one `request` field) fills the description; Reset, Dummy Data and Update Prompt sit in the header like every tool.

### Client Messaging (`/client-messaging`, not a LinkedIn tool)
- Each client in the `clients` collection keeps their **own** message format and exactly `SAMPLE_MESSAGE_COUNT` (2) sample messages. The samples are the shape to copy, never content to reuse; the format and the samples are what every message for that client follows.
- `components/client-messaging/ClientsModal` manages them behind `PromptAccessGate` (one tab per client, add, two-step delete, "Write to this client"). `GET /api/client-messaging/clients` is open, because the page needs the list to write anything; POST, PUT and DELETE need the prompt password.
- **One overall prompt** (`client-message`, editable from Update Prompt) writes every message, for every client and channel, under the fixed rules in `client-message-system`. It places `{{message_format}}`, `{{sample_messages}}`, `{{update}}`, `{{channel}}` and `{{country}}`; anything it doesn't place is appended.
- **The client's name never appears in the message.** Their sample messages usually greet them by name, so the first draft often copies it: that is expected and handled, not an error.
- **Nothing is thrown away for a content problem (`services/clientMessaging/generate.ts`).** The retry chain, outermost last:
  1. `withProviderRetry` retries a provider twice on transient failures, then Gemini falls back to OpenAI (shared behaviour).
  2. A first draft that fails on **both** providers is asked for once more, because the models are random enough that a second ask usually lands; only then does the user see an error.
  3. A draft that names the client, or runs more than `LENGTH_TOLERANCE` past the channel's length, gets up to `MAX_REWRITES` (2) targeted rewrites saying exactly what to fix. The cleanest version wins, and a rewrite that makes things worse is dropped.
  4. A name that survives every rewrite is removed in code (`removeNames`), and the result carries a warning to read it once before sending.
  - A draft counts as unusable only when it is empty or invents a `[placeholder]` that appears nowhere in the client's format, samples or the update: client updates are technical, so brackets the user wrote themselves are kept (`findPlaceholders` in `lib/generatedText.ts`).
  - When every attempt fails the route answers **503**, so the browser's own retry policy (`lib/apiClient.ts`) tries again before the user sees "the AI models did not answer".
- What you want to tell the client can be **typed or spoken** (the shared recorder, see Voice input; several takes build one update) and is capped at `UPDATE_MAX_LENGTH` (8000) in the field and in the API.
- Channels (`constants/clientMessaging.ts` `MESSAGE_CHANNELS`): LinkedIn, Upwork, Fiverr, Slack, Discord, WhatsApp and Email. Each sets the length the message is written to; only Email has a subject (`hasSubject`), and every other channel returns `subject: null`. Adding a channel = an entry here.
- Every message is saved to `client_messages` with the client it went to, and the result carries that record's id. Its output is a formal client message, not LinkedIn copy, so it does not run through the humanizer.

### Meeting Planner & Preparation (`/meeting-planner`, not a LinkedIn tool)
- The opposite end of the meetings module: this one is **before** the meeting. A meeting is a name, a day and a time; a person, and the whole of preparation, are optional. Its own collection (`meeting_plans`), its own routes and its own prompts, sharing nothing with the transcript module.
- **Days and times are plain strings** (`meetingDate` YYYY-MM-DD, `meetingTime` HH:mm) taken from the browser's clock (`lib/meetingDates.ts`, which shares `todayIso` with Daily Tasks), so a meeting never drifts a day or an hour on a server in another timezone. The routes accept a `today` at most a day from the server's UTC day.
- **The page:** today's meetings at the top (count, names, exact times, status), then a month calendar where each day shows its meetings by name and time, with "+N more" when a day is fuller than `DAY_CELL_MAX_MEETINGS`; selecting a day lists **all** of that day's meetings beside it, so nothing is ever hidden. The calendar moves a year either way (`CALENDAR_MONTH_RANGE`), one indexed month query at a time.
- **Status** is `pending` or `completed`, switched from today's list, the day panel or the meeting page, written with a small `PUT` and reflected everywhere at once.
- **Preparation** (`services/meetingPlanner/prepare.ts`) runs only when the user asks: the meeting is saved first (`prepStatus: "queued"`), then `POST /api/meeting-planner/[id]/prepare` writes it and saves it on the meeting. Reading the meeting never regenerates it; only "Prepare again" does. A failed run leaves the meeting and any earlier preparation untouched, records why, and can be retried. `claimPrepRun` makes two runs at once impossible, and treats a run older than `STALE_PREP_MS` as gone, since a serverless function can be killed mid-run.
- **What it reads:** the lead's profile, the conversation so far and the meeting notes the user pasted, plus `getFullSenderProfile()` (About Me + Rafay Profile Info) as the user's own context. It never gets a second source, and the fixed rules in the `meeting-prep-system` prompt (not editable) stop it inventing a background for either side: observations are marked `stated` or `inferred`, what nobody knows goes to `open_questions`, and `cautions` says what the user must not claim. `findUnsupportedFigures` catches a number no source contains and asks for one rewrite.
- The prompt the user can edit is `meeting-prep-preparation` (Update Prompt on the page); it decides the read of the person, the topics and the nine stages of the plan.

### Daily Tasks (`/daily-tasks`, not a LinkedIn tool)
- A task is one line of text on one day. **The browser sends its own day** (`todayIso` in `lib/taskDates.ts`) with every read and write, so the day never turns over at the server's midnight; the routes accept a `today` at most a day from the server's UTC day and reject anything further. Days are compared as plain `YYYY-MM-DD` strings (`shiftDate`), never as timestamps.
- **Writing a day at once:** the composer holds up to `MAX_TASKS_PER_SUBMIT` rows (Enter opens the next, a pasted list fills one row per line, Ctrl/⌘+Enter saves) and `POST /api/daily-tasks` takes them as one `contents` array. Blank rows are dropped and a row repeated in the same submission is saved once, so one `insertMany` writes the day. A task may be dated today or earlier, never later, because a later day would never show in the list.
- **The list:** `GET /api/daily-tasks?today=&page=` answers page 1 with today and the six days before it, grouped by day, newest day first, tasks in the order they were written. Later pages are older days, `HISTORY_DAYS_PER_PAGE` days at a time (two indexed queries, never one per day), so the history is reachable without ever loading it all. The page number is clamped to what exists.
- **Changing a day already on the list:** each day ends with an "Add task to this day" row (Enter saves and keeps it open for the next, Escape closes) which posts one task to that day, and every task has its own delete button. A task is one line, so **it deletes on a single click with no confirmation**, the way one saved note does in Quick Notes: the row leaves at once and comes back if `DELETE /api/daily-tasks/[id]` fails (404 when it was already gone). Only the week-old cleanup confirms.
- **States:** ticked is green (`success*` tokens), a day that has passed with the task still open is red with a cross (`error*`), everything else is plain. `PUT /api/daily-tasks/[id]` writes only `isCompleted` and `completedAt`; the page updates the checkbox at once and puts it back if the write fails.
- **`DELETE /api/daily-tasks?today=`** deletes every task older than the seven-day window in one bulk delete, behind `CleanupOldTasksDialog` (the shared `Modal`). Nothing is ever deleted automatically because a task got old.

### Quick Notes (`/quick-notes`, not a LinkedIn tool)
- A place to keep text worth reusing. **No AI, no prompts, no research:** the module only stores, lists, copies and deletes, so it has no prompt record and never calls a provider.
- Two panels: saved notes on the left (newest first), and the save box on the right (Ctrl/⌘+Enter saves, the box clears on success and the list reloads from the newest note).
- **The list scrolls rather than paging.** `NOTES_BATCH_SIZE` (40) notes load at once and the next batch loads when an `IntersectionObserver` sentinel at the end of the list comes into view (with a "Load more notes" button as the keyboard and no-observer path). There are no Previous/Next controls.
- Paging is by **cursor, not offset**: `GET /api/quick-notes?cursor=<createdAt>|<id>` returns `{ notes, nextCursor, total }`, and `listNotes` asks for one row more than the batch to know whether `nextCursor` is needed. A cursor points at a note, so deleting notes never makes the next batch skip or repeat one; an unreadable cursor simply starts again from the newest note.
- The routes: `GET` a batch, `POST` to save, `DELETE` to clear everything, and `DELETE /api/quick-notes/[id]` for one note (404 when it is already gone).
- A note is at most `NOTE_MAX_LENGTH` (20,000 characters, the same ceiling `constants/prompts.ts` uses); empty or blank content is refused. The same text saved twice is two notes, on purpose.
- Each note shows the first `NOTE_PREVIEW_MAX_LENGTH` characters and the time it was saved (no id, no character count); **its copy button always copies the whole note** (`CopyButton` with the note's full `content`).
- **One note deletes on a single click, with no confirmation** (they are small and easy to save again): the card leaves the list at once, the total follows, and a failed delete shows the error and leaves the note in place. Only **Clear All** confirms, through `ClearNotesDialog` (the shared `Modal`, so Escape and the backdrop cancel), and it touches only the `quick_notes` collection.
- Retries follow `lib/apiClient.ts`: the list (GET) and both deletes are retried on their own, while Save (POST) is not, because a repeat would save the note twice; it offers a Try again action instead.
- **The app has no accounts**, so notes are shared by everyone who opens it, exactly like the saved Trending searches and Dummy Data. If per-user notes are ever needed, that starts with adding auth to the app, not with this module.

### Reference Content (`/reference-content`, not a LinkedIn tool)
- A library of **named** reusable text: how to create an API key, a client setup procedure, a troubleshooting note, a stock explanation. **No AI, no prompts, no research**; it only stores, searches, copies and edits.
- It sits beside Quick Notes under "Workspace" and they stay separate on purpose: Quick Notes is untitled scraps you paste and drop (one-click delete, no search), this is curated material you keep, name, search and edit.
- Cards in a responsive grid (1 / 2 / 3 columns), newest first, each with **Copy** (always the whole text, however much the card shows), **Edit** and **Delete**. Text over `REFERENCE_PREVIEW_MAX_LENGTH` (320) is cut with a "Show all" toggle that opens it inside the card.
- **Add and Edit share one dialog** (`ReferenceItemDialog`, on the shared `Modal`), so editing starts from what was saved; an edited card updates in place instead of reordering the list. **Delete always confirms** (`DeleteReferenceDialog`, naming the item); Escape, the backdrop and Cancel all leave it alone.
- **Search** runs over the name *and* the text, case-insensitively, after `SEARCH_DEBOUNCE_MS` (300ms) of typing, and the search term is escaped so it stays plain text rather than a pattern. A search resets the list to its first batch, and the count in the header follows the search.
- **50 per request, enforced in `listItems`** (`Math.min(limit, REFERENCE_PAGE_SIZE)`), not just in the page: asking for more still returns 50. Paging is by cursor (`?cursor=<createdAt>|<id>`, the same shape Quick Notes uses) and the cursor and the search run in the same query, so paging inside a search never skips or repeats.
- Routes: `GET /api/reference-content?search=&cursor=` for a batch, `POST` to add, `PUT /api/reference-content/[id]` to edit, `DELETE /api/reference-content/[id]` to remove one.
- Limits: `REFERENCE_TITLE_MAX_LENGTH` (120) and `REFERENCE_CONTENT_MAX_LENGTH` (20,000, the app's usual ceiling); both fields are required, checked in the dialog and again by `ReferenceItemSchema` on the server.

### Meeting Minutes (`/meetings`, not a LinkedIn tool)
Reads a meeting of any length. A 5 hour transcript (1.5M characters, 131 parts) is a tested case, not a hope.

- **The transcript is saved before anything is analyzed** (`POST /api/meetings` answers in under a second) and is never touched by a run, so a failed or repeated analysis can never cost the source. It is also never sent to the history list, which reads a projection of summary fields only.
- **Map, then reduce.** `lib/transcriptChunks.ts` splits the transcript at speaker turns and paragraph ends into `CHUNK_MAX_CHARS` (12,000) parts, each carrying the tail of the part before it as context; every character lands in exactly one part, so nothing is silently dropped. `analyzeChunk` reads one part (the map), and `synthesizeMeeting` turns the parts into the meeting (the reduce).
- **The lists are merged in code, not by a model** (`services/meetings/aggregate.ts`). A model asked to merge 131 sets of notes summarises them, and a decision from the middle of the meeting disappears; instead every participant, decision, task and request from every part is carried across and de-duplicated here (near-duplicates fold by containment, and an owner or deadline any part stated is kept). The model is left with what needs judgement: the title, the purpose, the topics, the minutes. Only if the merged notes are too big to read at once are the parts folded hierarchically first, and only for what the model sees.
- **The run is resumable and bounded, with no queue.** `POST /api/meetings/[id]/process` reads at most `CHUNKS_PER_REQUEST` (6) parts, `CHUNK_CONCURRENCY` (3) at a time, writes each result as it lands and answers with `{ status, progress, hasMore }`. The page (`hooks/useMeetingRun.ts`) keeps calling while `hasMore`. So no request runs long enough to be cut off on a serverless host, closing the browser loses nothing, and a retry re-reads only the parts that are missing. Statuses: `saved` → `analyzing` → `summarizing` → `completed`, plus `failed` (the reason is stored on the meeting) and `stale`.
- **Editing the transcript invalidates the analysis**: the chunk results are deleted, the status becomes `stale`, and the page says the analysis came from the earlier transcript until Re-analyse (`{ restart: true }`) rebuilds it. Editing only the name leaves the analysis alone.
- A meeting saved without a name gets its title from the analysis (`isTitleGenerated`); a name typed by the user is always kept.
- **Nothing is invented.** Every participant, decision and task carries `evidence` ("stated" or "inferred", shown in the UI), the participant count follows the people actually listed, and what the meeting left open goes under `unknowns` instead of being filled in.
- Prompts: `meeting-chunk` and `meeting-synthesis` are editable through the usual Update Prompt editor; `meeting-system` holds the fixed rules and is not editable.
- The history is searched by name in the database with a status filter and cursor paging (`MEETINGS_PAGE_SIZE` 20), and refreshes itself every few seconds while any meeting is being analyzed.

## Project rules (`ai_docs/AI_PROJECT_RULES.md`)
- Keep `page.tsx` thin, with no business logic in it.
- TypeScript is strict. Don't use `any`, and don't disable lint, type or build checks.
- Zod-validate every API input.
- Use `next/image` over `<img>`.
- No unused or commented-out code, no duplication, no mocks or placeholder APIs.
