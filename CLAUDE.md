# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**LinkPilot AI** (`package.json` name: `linkpilot-ai`) is a set of exactly **8 LinkedIn writing tools**. Each one takes pasted LinkedIn text and generates copy the user posts themselves:

| Route | Tool | What it generates |
|---|---|---|
| `/trending-topics` | Trending Topics | 6 fresh, source-backed web/AI/SaaS topics from live web research, each with a ready-to-post LinkedIn post |
| `/connection-note` | Connection Note | ≤300-char invite note, 6 tones (incl. Recently Funded: congratulate a funded decision maker and offer to help; Hiring Startup: match a hiring startup's need, portfolio link, 15 minute call) |
| `/comment-writer` | Comment Writer | a comment on someone's post (text or screenshot), 6 tunes |
| `/post-comment-replies` | Post Comment Replies | a reply to one comment, 2 contexts × 6 tones (Show Expertise, Ask Their Opinion, Give Useful Tips, Share Real Example, Politely Disagree, Invite to DM), written as Abdul Rafay to the other person's latest comment |
| `/follow-up-message` | Follow-Up Message | a follow-up from a pasted conversation, 2 types |
| `/first-message` | First Message | a first DM from a profile, 5 tones (Curiosity Hook default) |
| `/inmail-message` | InMail Composer | subject + message from a profile, 4 tones (Trigger Event default) |
| `/conversation-reply` | Conversation Reply | analysis + next reply from a conversation, 6 tones (Validate + Share Pattern default) |

Alongside them there is one module that is not a LinkedIn writing tool:

| Route | Module | What it does |
|---|---|---|
| `/prompt-creator` | Prompt Creator | Turns a spoken or typed description of a task into one ready-to-paste English prompt, for a coding agent (Cursor, Claude, Antigravity) or for AI web search (ChatGPT, Gemini) |

`/` redirects to the first tool. There is no chat, knowledge base, analytics, inspector or auth. Those were removed on purpose, so don't reintroduce them. `src/constants/linkedinTools.ts` holds both lists: `LINKEDIN_TOOLS` (the 8 tools) and `APP_TOOLS` (those plus Prompt Creator, in its own `build` group), which drives the sidebar, the switcher, the sitemap, the manifest and `SEO_PAGES`.

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
| `OPENAI_TRANSCRIPTION_MODEL` | Reads recordings (Prompt Creator voice input) when Gemini can't, e.g. `gpt-4o-mini-transcribe`. Without it, voice input needs Gemini. |

Model names live **only** in env. Never hardcode a model id in code. Gemini 1.5 models are retired and return 404. The free Gemini tier has a small per-day request quota, and once it's used up every call falls back to OpenAI.

## AI architecture (`src/services/ai.ts`)

- `AI_PROVIDERS = ["gemini", "openai"]` is the full provider set. Don't add other providers (Grok/xAI, Anthropic, etc.).
- `createGeminiModel()` and `createOpenAIModel()` are the only places a LangChain chat model is constructed.
- `generateStructuredWithFallback({ schema, name, messages, validate?, providers?, onFallback?, timeoutMs?, signal? })` is how every tool generates. It tries Gemini first. If Gemini isn't configured, fails, times out (default 45s), returns output that fails the schema, or fails `validate`, it moves to OpenAI. It throws `UserFacingError` when no provider is configured. `onFallback` lets streaming tools show "switching to the backup model".
- **Retries (standard exponential backoff with full jitter, `lib/retry.ts` `withRetry`; only transient failures, `lib/transientErrors.ts` `isTransientError`: 408/425/429/5xx, dropped connections, Mongo network errors; never bad keys, 400s, used-up quotas, timeouts or aborts):**
  - AI calls: `withProviderRetry` retries a provider twice (research passes once) and honours `Retry-After` / Gemini's `retryDelay` (a wait over 8s isn't waited out), before the Gemini → OpenAI fallback. LangChain's own retries are off (`maxRetries: 0`) so they never stack.
  - MongoDB: `connectDB` retries the connection twice and never caches a failed one. Grounding-link resolving retries once.
  - Browser: every call goes through `fetchWithRetry` / `requestApi` (`lib/apiClient.ts`). GET/PUT/DELETE retry on network errors and 408/429/502/503/504. POST retries only with `{ retry: true }` (the generators and the three SSE tools, which only retry before the stream starts), never the password check or dummy-data create. A 500 is never retried.
- **Audio** is the one thing the chat models above don't share: Gemini reads a recording inside the chat model (an `audio` content block), and OpenAI reads it through its own transcription endpoint, `transcribeWithOpenAI` in `services/ai.ts` (`OPENAI_TRANSCRIPTION_MODEL`, same `withProviderRetry`). Only Prompt Creator uses it.
- `services/senderGuard.ts` wraps it for outreach tools. It detects invented claims about the sender (the `SENDER_CLAIM` regex) and asks for one rewrite.
- Shared fabrication checks, each comparing the output against the tool's sources: `lib/figures.ts` (`findUnsupportedFigures`: a number + unit no source contains) and `services/userClaims.ts` (`findUnsupportedUserClaims`: sentences about the user's work the sources don't support; `findInventedProof`: case studies, "a similar company", "in half"). Post Comment Replies, Conversation Reply and Follow-Up use them to trigger a targeted rewrite and to validate the humanized text. Reuse them instead of writing new regexes.
- `services/liveResearch.ts` (`runLiveResearch`) handles web research for Trending Topics, Comment Writer and Post Comment Replies:
  - It tries Gemini with `{ googleSearch: {} }` grounding first. Only grounding chunks count as sources, and their Google redirect URIs are resolved to real URLs.
  - Both providers take a list of passes (`geminiPasses`, `openAIPasses`) that run in parallel and are merged; failed passes are skipped. Trending runs one pass per lens in the `trending-search-lenses` prompt (so 3 Gemini research calls + 1 synthesis call per search); Comment Writer and Post Comment Replies use a single Gemini pass.
  - It falls back to OpenAI Responses `tools.webSearch()`, running parallel passes with `tool_choice: "required"`.
- **Humanization (`services/humanizer.ts`, `humanizeTexts`) is the last step of all 8 tools.** Each tool passes its final, already-verified texts (note, message, InMail subject + message, reply, comment, Trending hooks + bodies) through the user's saved **Humanization** prompt from Global AI Prompts (prompt `global-humanization`, `{{text}}` = the drafts), under the fixed rules in the `humanizer-system` prompt.
  - One structured call per result, each text as a `<draft id=… kind=… max_chars=… one_line=… rule=…>`. Code judges every rewrite on its own: same numbers, links, hashtags and @mentions; no new sender claim or placeholder; within `maxChars`/one line; plus the tool's own `validate(id, text)` (comment checks, conversation-reply problem checks, post-reply experience claims, Trending word limits).
  - Failed texts get one targeted retry told exactly what broke (the backup provider takes over if that still fails); a text that never passes keeps its verified draft. Every tool logs `humanized`. New tools must humanize their output too.
  - **Human style (strict), all 8 tools:** no em/en dashes as pauses, no colons or semicolons, no AI words (seamless, robust, leverage, delve, elevate, unlock…). Every writing prompt (each tone/tune/type/style prompt, each `*-system`, `trending-topics`, `trending-synthesis`, `global-humanization`, `humanizer-system`) ends with a `HUMAN STYLE (STRICT, NEVER BREAK THIS)` block; keep it on new or rewritten prompts. Lead-signals, About Me, Rafay Profile Info and research prompts don't have it (not written copy). In code, `lib/humanStyle.ts` (`applyHumanStyle`) rewrites every draft and rewrite inside `humanizeTexts` (links, hashtags, @mentions, times, ratios, hyphens and number ranges are kept; single-line fields such as InMail subjects get a comma instead of a new sentence), and a rewrite that adds a word from `findAiWords` is sent back.
  - Prompt Creator is the exception: it writes prompts for other AI tools, so its output is not humanized.
  - Global AI Prompts page: `/global-prompts` (`constants/globalPrompts.ts`, `services/globalPrompts.ts`); Rafay Profile Info is Abdul's facts source for Post Comment Replies (with About Me).

## Architecture

### Page pattern
Each tool route has two parts:
- A thin server `page.tsx` that holds only metadata and JSON-LD.
- A `"use client"` `*Client.tsx` that composes `Sidebar` and `Header` from `src/components/ui/`. Sidebar collapse state comes from `hooks/useSidebarCollapse` (localStorage key `isSidebarCollapsed`; Ctrl/⌘+B toggles it on desktop).
  - **Sidebar:** brand row (`SITE_LOGO_PNG` mark + "LinkPilot" + AI pill) as tall as the header; tools listed under `TOOL_GROUPS` (Discover, Outreach, Engage on posts, Conversations; each tool's `group` in `constants/linkedinTools.ts`); Global AI Prompts pinned at the bottom. The current tool gets a filled icon tile and a left accent bar. Collapsed on desktop it's a 76px icon rail with a custom tooltip (name + description or activity); the mobile drawer (`z-[45]`) always shows the full list. No per-link "open in new tab" arrow.
  - **Header:** `SITE_PURPOSE` ("LinkedIn Writing Assistant", `config/site.ts`), the background-activity indicator and a "Jump to a tool" search (`components/ui/ToolSwitcher`, also Ctrl/⌘+K) over the same links as the sidebar. No user/profile or AI-status badge.
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
- `created_prompts` (`models/CreatedPrompt.ts`): every prompt the Prompt Creator wrote (`name`, `prompt`, `target`, `request`, `requestSource`, `provider`, `editedAt`), including the user's later edits.
- One collection per tool for its outputs (`models/GenerationRecords.ts`, saved by `services/generationRecords.ts` from each generate route): `connection_notes`, `comment_writer_comments`, `post_comment_replies`, `follow_up_messages`, `first_messages`, `inmail_messages`, `conversation_replies`. Each holds the inputs, the choice (tone/tune/type/style/context), the main text, and the full `result`. Profile and conversation tools also store `lead` { name, headline, company } (`lib/leadInfo.ts`: from the pasted profile, else the conversation's sender lines, else the analysis). A record that fails to save is logged and never fails the response. New tools must save their outputs too.
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
- `TRENDING_TOPIC_COUNT` (6) caps the topics. Each topic's post is a `post_hook` (≤12 words, scroll-stopping) plus a 1–2 line `post_body`; `lib/trendingPost.ts` (`composeTrendingPost`) assembles hook, body, primary reference URL and hashtags into the one text the card shows and copies. Topics whose hook or body still contain a `[placeholder]` are rejected.


### Prompt Creator (`/prompt-creator`, not a LinkedIn tool)
- Describe a task by typing or by speaking, pick a target, and the module writes one complete English prompt for that target plus a 4 to 5 word name for it. `services/promptCreator/generate.ts` runs it through the usual `generateStructuredWithFallback` (name first, then the prompt, so the model settles the subject before writing), at a low temperature, and strips a code fence or a trailing full stop the model may add.
- Targets (`constants/promptCreator.ts` `PROMPT_TARGETS`, one editable prompt each): `editor-agent` (Cursor, Claude, Antigravity: TASK, CONTEXT, STEPS, CONSTRAINTS, VALIDATE, DONE WHEN, so the agent checks its own work) and `web-search` (ChatGPT, Gemini: GOAL, SEARCH, SOURCES, ANSWER, CHECK). The description is placed at `{{request}}`, inside `task_request` tags, and is data, never instructions. Adding a target = an entry here plus its `prompt-creator-<id>` record.
- **Voice input:** `components/prompt-creator/VoiceRecorder` records with `MediaRecorder` (it picks the first format the browser supports, stops itself at `VOICE_MAX_SECONDS` and always releases the microphone), posts to `/api/prompt-creator/transcribe`, and adds what was said to the description. `lib/audioType.ts` reads the container from the file's own bytes (wav, ogg, webm, mp4, mp3, flac). `services/promptCreator/transcribe.ts` tries Gemini first and falls back to OpenAI's transcription model whenever Gemini is unconfigured, fails, is out of quota or heard nothing, so speaking keeps working with either provider; the route answers 400 for a recording nobody can make out and 503 when neither provider is configured. The microphone needs `microphone=(self)` in the `Permissions-Policy` header (`next.config.ts`).
- Every created prompt is saved to `created_prompts` as part of the result, because the page needs its id: the name is renamed in place and the prompt text edited in place, and both are saved back to that record through `PUT /api/prompt-creator/created/[id]` (typing settles for ~1s first). `CreatedPromptPanel` is mounted under the record id, so a new prompt starts it fresh.
- Its output is a prompt for another AI, not LinkedIn copy, so it does not run through the humanizer and its prompts carry no HUMAN STYLE block.
- Dummy Data kind `prompt-requests` (one `request` field) fills the description; Reset, Dummy Data and Update Prompt sit in the header like every tool.

## Project rules (`ai_docs/AI_PROJECT_RULES.md`)
- Keep `page.tsx` thin, with no business logic in it.
- TypeScript is strict. Don't use `any`, and don't disable lint, type or build checks.
- Zod-validate every API input.
- Use `next/image` over `<img>`.
- No unused or commented-out code, no duplication, no mocks or placeholder APIs.
