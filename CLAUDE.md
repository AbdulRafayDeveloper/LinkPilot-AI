# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**LinkPilot AI** (`package.json` name: `linkpilot-ai`) is a set of exactly **8 LinkedIn writing tools**. Each one takes pasted LinkedIn text and generates copy the user posts themselves:

| Route | Tool | What it generates |
|---|---|---|
| `/trending-topics` | Trending Topics | 3 fresh, source-backed topics from live web research |
| `/connection-note` | Connection Note | ≤300-char invite note, 4 tones |
| `/comment-writer` | Comment Writer | a comment on someone's post (text or screenshot), 6 tunes |
| `/post-comment-replies` | Post Comment Replies | a reply to one comment, 2 contexts × 7 styles |
| `/follow-up-message` | Follow-Up Message | a follow-up from a pasted conversation, 2 types |
| `/first-message` | First Message | a first DM from a profile, 7 tunes |
| `/inmail-message` | InMail Composer | subject + message from a profile, 7 tunes |
| `/conversation-reply` | Conversation Reply | analysis + next reply from a conversation, 5 types |

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
  - It falls back to OpenAI Responses `tools.webSearch()`, running parallel passes with `tool_choice: "required"`.

## Architecture

### Page pattern
Each tool route has two parts:
- A thin server `page.tsx` that holds only metadata and JSON-LD.
- A `"use client"` `*Client.tsx` that composes `Sidebar` and `Header` from `src/components/ui/`. Sidebar collapse state comes from `hooks/useSidebarCollapse` (localStorage key `isSidebarCollapsed`).

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
- Results render through `ResultCard` / `GeneratedResultPanel` with `CopyButton variant="prominent"`.

### Prompt password (`services/promptAccess.ts`, no database)
- Both editor bases (`PromptTabsModal`, `ReplyPromptsModal`) render inside `PromptAccessGate`. The editor mounts, and loads prompts, only after `GET /api/prompt-access` reports `unlocked`.
- `POST /api/prompt-access` checks the password against env:
  - A correct password sets a signed httpOnly `lp_prompt_session` cookie, valid 48h, that covers every tool.
  - Each wrong password is counted in a signed `lp_prompt_attempts` cookie. The 3rd locks that browser for 24h, and while locked even the correct password is refused.
  - Cookies are HMAC-signed with a key derived from the password, so changing the password ends every session.
- Every prompt API handler (all `…/prompts` routes and `trending-topics/prompt`, GET and PUT) starts with `requirePromptAccess()`. New prompt routes must too. Generation routes stay open.
- This is intentionally light security: clearing cookies resets the attempt counter.

### Trending Topics persistence
The last successful search is kept in `localStorage` (`lib/trendingResultStore.ts`, key `linkpilot:trending-topics`) for 24h. `useTrendingTopicsSearch` shows it via `useSyncExternalStore` until a new search replaces it. Bump `STORAGE_VERSION` when `TrendingResult` changes shape.

## Project rules (`ai_docs/AI_PROJECT_RULES.md`)
- Keep `page.tsx` thin, with no business logic in it.
- TypeScript is strict. Don't use `any`, and don't disable lint, type or build checks.
- Zod-validate every API input.
- Use `next/image` over `<img>`.
- No unused or commented-out code, no duplication, no mocks or placeholder APIs.
