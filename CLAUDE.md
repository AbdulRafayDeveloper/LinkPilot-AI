# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**LinkPilot AI** (`package.json` name: `linkpilot-ai`). It started as a copy of an "Enterprise Support AI Hub" helpdesk project and was renamed. The working code is still that helpdesk console: RAG chat over uploaded documents and crawled websites, a knowledge-base manager, an analytics dashboard, and a conversation "inspector". The product is moving toward LinkedIn tooling. The sidebar's "LinkedIn Tools" section is placeholder UI (see below). Descriptive copy (page descriptions, welcome text, `src/prompts/system.md`) still describes the helpdesk product. `README.md` is empty and the git repo has no commits yet.

The brand name and public URL live in `src/config/site.ts` (`SITE_NAME`, `SITE_URL`). Use those constants and don't hard-code either one.

## Commands

```bash
npm install          # .npmrc sets legacy-peer-deps=true; LangChain peer ranges conflict without it
npm run dev          # next dev (Next.js 16, Turbopack) → http://localhost:3000. Only ONE dev server per project folder is allowed: a second one exits with "Another next dev server is already running", so reuse the running one
npm run build        # production build (build.bat just runs this)
npm run start        # serve the production build
npm run lint         # runs bare `eslint` (flat config; Next 16 no longer ships `next lint`)
npx tsc --noEmit     # type-check; there is no script for it
```

`node_modules` is not installed in a fresh checkout, so run `npm install` first. `npm run lint` currently reports errors in pre-existing code (`no-explicit-any`, `react-hooks/set-state-in-effect`, `<img>` usage). `npx tsc --noEmit` is clean.

**Tests:** there is no test framework and no test script. `src/test_scripts/*.js` are ad-hoc CommonJS scripts:
- `node src/test_scripts/test_website_scraping.js` is self-contained (it only needs `cheerio`) and runs as-is.
- `test_advanced_features.js` and `test_multimodal.js` `require()` the `.ts` service files, which import through the `@/` path alias. They won't run under plain `node`. You need a TS runner with tsconfig-paths support.
- `GET /api/test-advanced` returns a static message and runs nothing.

## Runtime dependencies & environment

- **MongoDB** is required. Every API route calls `connectDB()` from `src/lib/db.ts`, which caches the connection on `globalThis.mongooseGlobal` and fails fast after 5s.
- **ChromaDB** is optional. It runs locally at `CHROMA_URL`, or on Chroma Cloud when `CHROMA_API_KEY`, `CHROMA_TENANT` and `CHROMA_DATABASE` are all set. When Chroma is unreachable, indexing still reports success (`warning: "ChromaDB Offline"`), RAG returns a `NO_CONTEXT_RETRIEVED` sentinel, and deletes skip the vector purge. The app keeps working without vectors.
- **OpenAI** handles chat, the complexity classifier, all embeddings, Trending Topics ranking plus fallback web search, and fallback writing for the LinkedIn tools. **Google Gemini** handles chat, multimodal parsing, and primary writing for the LinkedIn tools.
  - ⚠️ `gemini-1.5-*` models are retired and return 404. With `GEMINI_LIGHTWEIGHT_MODEL=gemini-1.5-flash`, every Gemini call fails and OpenAI answers, which works but isn't Gemini-first. Set a current Gemini model name in `.env.local`. **Grok (xAI)** is optional and only does Trending Topics search; it is enabled when both `XAI_API_KEY` and `XAI_SEARCH_MODEL` are set.
- `src/config/env.ts` is the single source of env config: a Zod schema with defaults, imported for side effects in `layout.tsx`. Missing keys default to `mock-openai-key` / `mock-google-key`. `parser.ts` checks `GOOGLE_API_KEY.includes("mock")` and, when it matches, **returns hard-coded mock text** for pptx, images, audio and video instead of calling any API. If multimodal output looks canned, check the key.
- Adding an env var takes three steps: add it to the Zod schema, add it to **both** `process.env` mappings in `env.ts` (`getParsedEnv` and `validateEnv` duplicate the list), and document it in `.env.example`.
- ⚠️ `.gitignore` contains `.env*`, which also ignores `.env.example`. Add `!.env.example` if it needs to be committed.
- `JWT_SECRET`, `jose` and `bcryptjs` are present but unused. There is no auth, middleware or route protection anywhere.

## Architecture

### Page pattern
Each route (`/`, `/knowledge-base`, `/analytics`, `/inspector`) has two parts:
- A server `page.tsx` that holds only `metadata` and JSON-LD breadcrumb markup.
- A large `"use client"` `*Client.tsx` component that holds all UI state and `fetch` calls.

Every client component composes `Sidebar` and `Header` from `src/components/ui/`. Each one separately re-implements sidebar-collapse persistence through `localStorage` key `isSidebarCollapsed`. The `Sidebar` fetches the conversation list itself (`/api/conversations`). Conversation selection only takes effect on `/`, where `WelcomeClient` passes `onSelectConversation`.

The sidebar's **LinkedIn Tools** section sits above New Chat. It renders `LINKEDIN_TOOLS` from `src/constants/linkedinTools.ts`, which has 8 entries, each with an `id`, title, short description, lucide icon and an optional `href`. Tools with an `href` render as a `Link` with an active state; only Trending Topics has one so far. The others are inert buttons until they get a page. The sidebar column scrolls as a whole (`overflow-y-auto`) and Recent Chats keeps `min-h-[180px]`.

New pages should use `useSidebarCollapse()` (`src/hooks/`) instead of copying the localStorage effect the older pages use. It shares the same `isSidebarCollapsed` key, is hydration-safe, and is lint-clean.

Styling is Tailwind with Material-3-style color tokens defined in `tailwind.config.ts` (`bg-surface-container`, `text-on-surface-variant`, `bg-primary-container`, and so on). Use those tokens, not raw colors. The `*.module.css` files in `src/components/ui/` and `src/app/page.module.css` are unused.

### Layers
- `src/services/`: business logic (`ai.ts`, `rag.ts`, `vectorstore.ts`, `parser.ts`, `websearch.ts`, `prompts.ts`, `tools.ts`)
- `src/models/`: Mongoose models `Document` (KB metadata), `Conversation` (embedded `messages[]` with `sources`) and `Setting` (generic unique `key` → `value` app settings)
- `src/prompts/*.md`: prompt templates loaded at runtime by `loadPrompt()` and filled with `renderPrompt()` (`{{VAR}}` placeholders). Only `system`, `router` and `agent` have hard-coded fallbacks; a missing trending template throws instead of running on a weaker prompt. `next.config.ts` `outputFileTracingIncludes` ships `src/prompts/**` with API routes.
- `src/services/ai.ts` is the model factory. Use `createOpenAIModel(tier, options)` rather than constructing `ChatOpenAI` directly. `createGrokSearchModel()` returns `null` when Grok isn't configured.
- `src/app/api/`: route handlers. Dynamic `params` is a `Promise` and must be awaited (Next 15+).

### Chat pipeline: `POST /api/chat` (SSE)
1. Zod validation (message ≤ 4000 chars), then a regex prompt-injection block that returns 403.
2. Loads the last 10 messages of `conversationId` as history, unless `isTemporary`.
3. Retrieves context from **either** `searchWeb()` (DuckDuckGo HTML scrape, when `webSearch` is true) **or** `searchRAGContext()` (Chroma top-5). It never uses both.
4. `classifyComplexity()` sends the query to the lightweight model with `router.md`. A reply containing "complex" selects the `premium` tier, anything else `lightweight`.
5. `getModel(provider, tier)` returns ChatOpenAI or ChatGoogleGenerativeAI. Its OpenAI↔Gemini fallback only catches *constructor* errors, not API failures during streaming.
6. The system prompt is assembled inline from `system.md`, attachment text and the retrieved context. Image attachments go in as `image_url` content parts.
7. Streams tokens, then persists the user and assistant message pair (creating the conversation when there is no id).

SSE event shapes, as consumed by `WelcomeClient.handleSendMessage`:
- `{status, text, sources?}`, where `status` is `WEB_SEARCHING`, `RAG_SEARCHING`, `ROUTING`, `MODEL_SELECTING`, `GENERATING`, `COMPLETE` or `ERROR`
- `{token}`
- `{conversationId}`, sent once when a conversation is created

The client splits each network chunk on `\n\n` and silently drops JSON it can't parse. If you change the event format, keep each event small and self-contained. The frontend always sends `provider: "openai"`.

Chat attachments are parsed first through `POST /api/knowledge/parse-temp`, which returns text and indexes nothing. The text is then sent inline in the `attachments` array.

### Knowledge-base ingestion: `POST /api/knowledge`
Three input modes:
- **multipart `file`**: runs `parseDocument()`, then `indexDocumentVectors()`, then creates a `Document` record.
- **JSON `{url}`**: `crawlWebsite()` reads `sitemap.xml` first, then follows same-host links (up to 40 pages), and saves the result as a `type: "web"` document.
- **JSON `{localFileName}`**: reads the file from **`ai_docs/mock_docs/` on the server**. The KB client uses this path automatically for files over 4.2 MB (a workaround for Vercel's body limit), so large uploads only work when that file already exists in `ai_docs/mock_docs/`.

Other ingestion facts:
- Chunking uses a custom fixed-width `CharacterTextSplitter` in `vectorstore.ts` (500 chars, 100 overlap), not LangChain's splitter.
- **The join key between MongoDB and Chroma is the document `name`**, stored as Chroma metadata `source`. Duplicate names get a random `_xxxxxx` suffix before indexing. `DELETE /api/knowledge/[id]` purges vectors with `filter: { source: name }`.
- Uploaded files are **not stored**. Only `previewText` (the first 300 chars) is kept. `PUT /api/knowledge/[id]` (re-index) re-crawls `web` docs, re-parses docs found in `ai_docs/mock_docs/`, and otherwise re-indexes just `previewText`. Only `web` docs get their old vectors purged first. Other types gain duplicate chunks.
- Supported extensions: pdf, docx, txt, md, csv, json, html, pptx, png/jpg/jpeg, mp3/wav, mp4. The list appears separately in `parser.ts`, the POST route and the `KnowledgeBaseClient` selection handlers, so update all three together.
- PDF parsing: `parser.ts` monkey-patches `Module.prototype.require` to stub `@napi-rs/canvas`, polyfills `DOMMatrix`, and preloads the pdfjs worker. It falls back to a regex text extractor. Don't remove the shims without testing PDF uploads.
- Multimodal parsing calls the Gemini REST API directly with a hard-coded `gemini-1.5-flash` model, falling back to OpenAI vision or Whisper.

### Trending Topics (`/trending-topics`)
This is live web research that returns up to 3 LinkedIn-ready topics. It never caches or stores results, and every click runs a fresh search.

- **Prompt (single source of truth):** `services/trending/prompt.ts` reads the `Setting` document with key `trending_topics_prompt`, falling back to `src/prompts/trending-topics.md`.
  - The prompt is edited through `GET`/`PUT /api/trending-topics/prompt` and the Update Prompt modal. The frontend never holds its own copy.
  - Saving text identical to the default deletes the custom record, so later improvements to the default template take effect again.
- **Pipeline** (`services/trending/index.ts` → `findTrendingTopics`, streamed by `POST /api/trending-topics/search` as SSE):
  1. `research.ts`: Grok runs first via `createGrokSearchModel()`, which is LangChain `ChatOpenAI` pointed at xAI's Responses API with built-in `web_search` and `x_search` tools, in one call. It is only used when both `XAI_API_KEY` and `XAI_SEARCH_MODEL` are set.
     - The automatic fallback is OpenAI `tools.webSearch()` on `OPENAI_LIGHTWEIGHT_MODEL`. It runs **one pass per lens** in parallel (lenses are in `src/prompts/trending-search-lenses.md`) with `tool_choice: "required"`, because the mini model searches shallowly and sometimes skips searching.
     - Research needs at least 3 cited sources to count as usable evidence.
  2. `synthesize.ts`: one LangChain `withStructuredOutput(SynthesisOutputSchema, { strict: true })` call on the lightweight OpenAI model ranks candidates and writes all fields.
     - Strict mode requires every field to be present, so optional fields are `.nullable()`, and URL and length limits are enforced after parsing.
     - `post_approach` and `post_ends_with_question` come *before* `short_post` in the schema on purpose. The model commits to an approach before it writes the post.
  3. `finalize.ts`: code-level verification.
     - Reference URLs must appear in the search citations.
     - `event_date` must be stated in the research text or in a verified source URL, and be no more than `MAX_TOPIC_AGE_DAYS` (30) old.
     - Freshness labels are computed from the verified date, duplicate events are removed, and lists are capped.
     - Topics that fail verification are dropped, never repaired. Each run logs `Trending Topics run: {…rejected}` with the rejection reasons.
- **Prompt layering:**
  - `trending-research.md` and `trending-synthesis.md` are locked application rules: precedence, the max-3 cap, URL/date rules, and no invented metrics.
  - The user's prompt goes inside `<configured_prompt>`, and web text inside `<untrusted_research_data>`.
  - `sanitize.ts` strips those delimiter tags from both sources.
  - Subject, recency and post style belong in the editable prompt. Don't hard-code them in the app-level prompts or in code.
- **Frontend:** `useTrendingTopicsSearch` is the `idle → loading → success | partial_success | error` state machine. It clears results before each search. `lib/sse.ts` is a buffered SSE reader, safe for large final events.
- **OpenAI key:** it is always required, even when Grok handles search, because ranking runs on OpenAI.

### Shared LinkedIn-tool infrastructure (reuse these; don't duplicate them)
- **Editable prompts:** `services/promptStore.ts` provides `getStoredPrompts`, `getStoredPrompt` and `saveStoredPrompt` on the `Setting` model, one key per prompt. Saving the default text deletes the custom record.
  - Every tool uses this store, with `PromptUpdateSchema` (`lib/validation/prompt.ts`) in its PUT route.
  - `components/prompts/PromptEditorField` and `PromptModalParts` provide the editor UI: restore default, copy, counter, footer, and load/retry states.
- **Writing models:** `generateStructuredWithFallback()` in `services/ai.ts` runs LangChain `withStructuredOutput` with **Gemini first and OpenAI only as a fallback**.
  - The fallback triggers when Gemini is unconfigured, errors, times out (`timeoutMs`, 45s per attempt), or `validate()` returns a reason.
  - `providers` and `onFallback` are optional. Both models use the ENV `*_LIGHTWEIGHT_MODEL` unless `tier` is set.
- **Errors and client:** throw `UserFacingError` (`lib/errors.ts`) only for messages that are safe to show the user; routes use `toUserFacingMessage(error, fallback)`. Client code calls routes through `requestApi()` (`lib/apiClient.ts`), which uses the `{ success, message, data }` envelope.
- **Sender profile ("About Me"):** `services/senderProfile.ts` holds the user's own description in one shared Setting key, `sender_profile`. It's the **only** source of facts about the sender, and every tool that writes "what I do" should read it.
  - `getSenderProfile()` returns `null` while the text is still the unedited template (`src/prompts/sender-profile.md`). Treat `null` as "no profile".
  - It's edited as the "About Me (sender)" tab of both the First Message and InMail prompts modals, which save the same key.
- **Composing prompts:** `composePromptMessage(template, blocks, variables)` (`services/promptComposer.ts`) wraps each data block in delimiter tags and strips those tags from every input. A `{{variable}}` places a block where the prompt wants it; blocks the prompt leaves out are appended under their label.
- **Output helpers:** `lib/generatedText.ts` provides `cleanGeneratedText` and `containsPlaceholder`.
- **Shared UI:**
  - `useGenerationRequest(endpoint, fallbackError)` returns `generate`, `reset`, `status`, `result` and `error`, and runs one request at a time.
  - `RadioCardGroup` renders the option cards. `PromptTabsModal` handles several independent prompts; `orientation="vertical"` suits many tabs.
  - `ResultCard` is the output card shell (idle, loading and error states; success content comes in as children), for multi-part results.
  - `GeneratedResultPanel` is `ResultCard` plus a single text and a prominent `CopyButton variant="prominent"`.
- **No sender profile → no sender claims:** `gpt-4o-mini` invents sender facts ("I specialize in…", "our shared interest…") even when told not to.
  - Give the sender block `emptyText: NO_SENDER_PROFILE_TEXT`, which says nothing is known about the sender.
  - Generate through `generateWithoutSenderClaims()` (`services/senderGuard.ts`). When there is no sender profile, it checks the output with the `SENDER_CLAIM` regex, allows one rewrite, then shows a warning.
  - Don't use it where true self-claims are expected, such as replies inside a conversation.
- **Outreach tunes (First Message and InMail):**
  - `constants/outreachTunes.ts` holds the 7 tune ids and labels plus `ABOUT_ME_TAB_ID`. `constants/linkedinLimits.ts` holds LinkedIn's length limits.
  - `createOutreachPromptStore({ settingKey, templateName })` (`services/outreachPrompts.ts`) gives a module its own per-tune prompts plus the shared About Me.
  - The shared UI is in `components/outreach/`: `ProfileTuneForm`, `OutreachPromptsModal` with `createOutreachPromptsApi(endpoint)` called at module level, `AboutMeNotice` and `AnalysisDetails`.
  - `constants/firstMessage.ts` re-exports `ABOUT_ME_TAB_ID` and `LINKEDIN_MESSAGE_MAX_CHARS` for existing importers.

### First Message (`/first-message`)
- **Tunes:** there are 7 in `FIRST_MESSAGE_TUNES`, and the default is `just-first-impressive`. Each has its own Setting key (`first_message_prompt:<tune>`) and template `src/prompts/first-message-<tune>.md`. The prompts modal also includes the shared About Me tab (`about-me` → `sender_profile`).
- **Generation:** `services/firstMessage/generate.ts` puts the locked rules from `first-message-system.md` in the system message. The user message is the saved tune prompt with `{{sender_profile}}`, `{{profile_data}}` and `{{tune}}` filled in via `composePromptMessage`.
  - The schema asks for `recipient_summary`, `key_detail` and `sender_link` before `message`, so the model picks its facts before it writes.
  - Length is left entirely to the tune prompt. The app only warns above LinkedIn's 8,000-character message limit.
- **API:**
  - `GET /api/first-messages/prompts` returns the 7 tunes plus About Me
  - `PUT /api/first-messages/prompts/[id]` saves one prompt
  - `POST /api/first-messages/generate` takes `{ profileData, tune }`
- **Logging:** the log line is `First message generated: {json}` (tune, provider, `senderClaimRewrite`, `unsupportedSenderClaim`). It's logged as a JSON string because Next's dev file log drops object arguments.

### InMail Message (`/inmail-message`, sidebar id `inmail-composer`)
- **Tunes:** the same 7 outreach tunes, but with **InMail's own** prompts: Setting keys `inmail_prompt:<tune>` and templates `src/prompts/inmail-<tune>.md`. Saving an InMail tune never touches the First Message tune with the same name. Only About Me is shared.
- **Output:** two separate fields, `subject` and `message`, from one structured call (`services/inmail/generate.ts`).
  - The schema order is `recipient_summary`, `key_detail`, `sender_link`, `subject_hook`, `subject`, `message`. `subject_hook` makes the model commit to a concrete detail (a project, number, post or company) before writing the subject; without it, `gpt-4o-mini` writes generic topic subjects.
  - `inmail-system.md` holds the subject contract: written on purpose, not a shortened message; anchored in `key_detail`; sentence case; no misleading curiosity gap; generic subjects are banned unless the tune prompt allows them.
  - `cleanMessage` strips a repeated subject line or a "Subject:" line from the body.
  - The sender-claim guard checks the subject and the message together.
  - Warnings appear above LinkedIn's InMail limits (subject 200, body 1,900 characters); nothing is ever truncated.
- **API:**
  - `GET /api/inmail-messages/prompts` returns the 7 tunes plus About Me
  - `PUT /api/inmail-messages/prompts/[id]` saves one prompt
  - `POST /api/inmail-messages/generate` takes `{ profileData, tune }` and returns `{ subject, message, … }`
- **UI:** `InMailResult` renders separate Subject and Message cards, each with its own prominent copy button. The two never share one copy action.

### Connection Note (`/connection-note`)
- **Tones:** they're listed in `CONNECTION_NOTE_TONES` (`constants/connectionNote.ts`). Each tone has its **own** Setting key (`connection_note_prompt:<tone>`) and its own default template `src/prompts/connection-note-<tone>.md`. These are not variations of one master prompt. Adding a tone means adding an entry plus a template.
- **Generation:** `services/connectionNote/generate.ts` builds the model input in three layers:
  - the system message holds the locked rules from `connection-note-system.md` (precedence, no invented facts, no `[placeholders]`, the 300-character LinkedIn cap)
  - the user message holds the saved tone prompt
  - the pasted profile goes inside `<profile_data>` tags, which are stripped from the input
  - `{{profile_data}}` in a tone prompt places the profile block; without it, the block is appended (via `composePromptMessage`). `{{tone}}` inserts the tone label.
- **Validation:** an empty note or one containing a placeholder triggers the OpenAI fallback. A note over 300 characters gets one controlled rewrite. If it's still too long, it's returned with a `warning` and never truncated.
- **API:**
  - `GET /api/connection-notes/prompts` returns all tones
  - `PUT /api/connection-notes/prompts/[tone]` saves one tone only
  - `POST /api/connection-notes/generate` takes `{ profileData, tone }`
- **Logging:** each generation logs `Connection note generated: { tone, provider, characters }`. Use that line to confirm which provider actually answered.

### Analytics & Inspector are derived, not measured
There is no telemetry store.
- `GET /api/analytics` recomputes everything from `Conversation` documents on every call. The client polls every 8s. Tokens are estimated as `chars/4`, latency is simulated, and the "GPT-4 vs Gemini" split is inferred from user-message length > 60.
- `GET /api/inspector?traceId=<conversationId>` builds a synthetic timeline from the conversation's first message pair.

Real metrics would require persisting them in the chat route.

### Duplicated code to keep in sync
- `buildChromaClient()` is copy-pasted in `services/vectorstore.ts`, `services/rag.ts` and `app/api/knowledge/[id]/route.ts`, and the same logic is inlined in `lib/db.ts` (startup heartbeat). Chroma connection changes must go into all four.
- `OpenAIEmbeddings` is instantiated separately in `vectorstore.ts`, `rag.ts` and `knowledge/[id]/route.ts`. The last one ignores `OPENAI_EMBEDDINGS_MODEL`.

### Not wired up
`services/tools.ts` (Zod-validated mock ticket tools: create, update, escalate, close) and `prompts/agent.md` exist, but nothing calls `executeTool()` or `loadPrompt("agent")`.

## Project rules & planning docs (`ai_docs/`)

- `AI_PROJECT_RULES.md` is marked mandatory for every change. The points most relevant to this code:
  - App Router with Server Components by default; keep `page.tsx` thin with no business logic.
  - TypeScript strict and no `any` unless unavoidable. The existing code uses `any` in many places; don't add more.
  - Zod-validate every API input and return consistent `{ success, message, data }` envelopes.
  - Prompts live in dedicated files under `src/prompts/`, separate from logic.
  - Every env var must appear in `.env.example`.
  - Use `next/image` over `<img>`.
  - No unused or commented-out code, no duplication.
- `Implementation_plan.md` and `Tasks.md` hold the original phased plan (Tasks 1–20). All tasks are checked off.
- `PROGRESS.md` is a turn log ("Last Completed Turn / Next Turn / Known Issues"). The original workflow updated it and ticked `Tasks.md` after each task.
- `advance_req.md` lists the multimodal data sources that were added later (pptx, OCR, audio, video; email integrations are not implemented).
- `ai_docs/mock_docs/` holds sample files used by the test scripts, by the `localFileName` ingestion path and by re-indexing.
