# LinkPilot AI

LinkPilot AI is a Next.js app with eight writing tools for LinkedIn. You paste LinkedIn text (a profile, a post, a comment thread or a message conversation), pick a tone, and get copy ready to post or send yourself. Generation runs on Google Gemini, with OpenAI as an automatic fallback. Every tone's prompt can be edited from the UI and is stored in MongoDB.

## Overview

The app is built for one person doing LinkedIn outreach and engagement, such as a freelancer or consultant who writes connection notes, comments, replies and follow-ups every day. Nothing is posted or sent from the app. Each tool produces text, and you copy it into LinkedIn.

The core workflow is the same in every tool:

1. Open a tool from the sidebar.
2. Paste the input, or load a saved sample with **Dummy Data**.
3. Choose a tone (called a tone, tune, style or type depending on the tool).
4. Generate. The server loads the saved prompt for that tone, calls the model, checks the output, rewrites it once more to sound natural, and returns it.
5. Copy the result. **Update Prompt** changes how that tone writes in future runs.

`/` redirects to the first tool, Trending Topics.

## Features

### LinkedIn tools

| Tool | Route | Input | Output | Options |
|---|---|---|---|---|
| Trending Topics | `/trending-topics` | None | Up to 6 source-backed topics in web development, AI and SaaS, each with a ready-to-post LinkedIn post | One editable research brief |
| Connection Note | `/connection-note` | Their profile | A connection request note of at most 300 characters | Professional, Impressive, Direct, Professional + Pitch |
| First Message | `/first-message` | Their profile | A first DM | Curiosity Hook (default), Value First, Credibility Play, Problem-Solution, Soft Consultation |
| InMail Message | `/inmail-message` | Their profile | A subject line and message body | Trigger Event (default), Personalized Observation, Credibility Play, Curiosity Hook |
| Comment Writer | `/comment-writer` | A post as text or a screenshot | A comment on the post | Thoughtful, Based on My Past Experience, Latest Trends / Informative, Concerning, Appreciative, Impressive |
| Post Comment Replies | `/post-comment-replies` | Comments, plus the post as optional text or a screenshot | A reply of at most 280 characters to the latest comment | 2 contexts (Someone Else's Post, My Post) × 6 styles (Show Expertise, Ask Their Opinion, Give Useful Tips, Share Real Example, Politely Disagree, Invite to DM) |
| Follow-Up Message | `/follow-up-message` | A conversation, plus their profile (optional) | A follow-up message and a lead signals table | Non-Pitch, Pitch |
| Conversation Reply | `/conversation-reply` | A conversation, plus their profile (optional) | A conversation analysis, the next reply and a lead signals table | Validate + Share Pattern (default), Build Credibility Frame, Problem-Challenge Bridge, Acknowledge + Question, Offer Resource Value, Curiosity Close |

Tool-specific details:

- **Trending Topics** runs live web research, ranks the candidates, and keeps only topics whose reference URLs came from the search results and whose event date is verified and at most 30 days old. Each post is a hook of at most 12 words and a short body, followed by the source link and hashtags. The latest search is saved to a file and shown to everyone who opens the page. **Reset** removes it.
- **Comment Writer** and **Post Comment Replies** accept the post as a PNG, JPG or WEBP screenshot of up to 4 MB. The model transcribes it first, and the image type is checked from the file's bytes rather than the client's MIME type.
- **Post Comment Replies** writes as the account owner (`REPLY_AUTHOR_NAME` in `src/constants/postCommentReplies.ts`) and always answers the latest comment that someone else wrote.
- **Follow-Up Message** and **Conversation Reply** also return a 16-row lead signals table: scores for meeting chance, relationship strength, client potential and buying intent, plus country, seniority, technical level, decision role, urgency, budget signal, company size, industry, main need, main objection and a suggested next step.
- **Conversation Reply** also scores the conversation (client potential, momentum, recipient interest, risk level and more) before it writes the reply. That analysis never sees the chosen tone, so the tone can't change the scores.

### Prompt management

- Every tone has its own prompt, stored under its own key. Editing one never changes another.
- The default prompts are Markdown files in `src/prompts/`. A saved edit overrides the file. Saving text identical to the default deletes the saved copy, so later changes to the file apply again.
- **Update Prompt** opens a tabbed editor in each tool. Drafts are kept per tab, and one save stores every edited tab.
- **About Me** is edited from First Message or InMail. It's the sender profile that First Message, InMail, Comment Writer, Conversation Reply and Post Comment Replies use as their only source of facts about you. Follow-Up Message and Conversation Reply also pass it to the lead signals.
- The **Global AI Prompts** page (`/global-prompts`) holds two shared prompts:
  - **Humanization**: used by all eight tools as the final rewrite.
  - **Rafay Profile Info**: an extra source of facts for Post Comment Replies.

### Output checks

- **Structured output everywhere.** Every model call returns JSON validated against a Zod schema.
- **Fabrication checks.** Code compares drafts against the tool's sources and asks for a targeted rewrite when it finds:
  - numbers with units that no source contains
  - claims about your own work that About Me doesn't support
  - invented social proof such as case studies or "a similar client"
- **LinkedIn length limits:** 300 characters for a connection note, 1,250 for a comment, 8,000 for a message, and 200 for an InMail subject with 1,900 for its body. A note that's too long gets one controlled rewrite. Other results show a warning instead of being truncated.
- **Humanization pass.** The final text is rewritten with the Humanization prompt. Each rewrite is rejected if it changes a number, link, hashtag or @mention, adds a claim about you, adds AI-sounding words or breaks a limit. A rejected rewrite gets one retry, and if that also fails, the verified draft is kept.
- **Style clean-up.** A code pass (`src/lib/humanStyle.ts`) removes pause dashes, colons and semicolons and replaces words like "seamless" and "robust".
- **Untrusted input.** Pasted text goes inside delimiter tags that are stripped from the input, and every system prompt tells the model to treat it as data rather than instructions.

### Workspace

- The sidebar groups tools into Discover, Outreach, Engage on posts and Conversations. It collapses to an icon rail (Ctrl/⌘+B), and a tool switcher opens with Ctrl/⌘+K.
- Inputs and results are kept in module-level stores, so switching tools doesn't lose work. A generation started before you switch keeps running in the background.
- Each browser tab keeps its own inputs and results, so you can run the same tool in several tabs with different inputs. A tab restores its own state after a reload. A new tab starts from the latest state saved in the last 24 hours.
- The header and sidebar show which tools are still writing, or have finished while you were on another page.
- The streaming tools (Trending Topics, Comment Writer and Post Comment Replies) show each pipeline stage as it happens, including a switch to the backup model.
- Every tool has a **Reset** button, which clears the inputs and result but keeps the chosen tone.

### Dummy data

Sample inputs are Markdown files in `src/data/`: profiles, posts, comment threads and two kinds of conversation. The **Dummy Data** dialog in each tool can add, edit, delete and copy samples, or fill the tool's inputs with one. No database is involved.

### Prompt editor access

There is no user authentication. Viewing or changing prompts and dummy data requires the password set in `PROMPT_EDITOR_PASSWORD`:

- A correct password unlocks every editor in that browser for 48 hours.
- Three wrong attempts lock that browser out for 24 hours.
- If the variable is unset, prompt editing is disabled.

Generation endpoints are open to anyone who can reach the app.

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack in dev), React 19, TypeScript 5 |
| Backend | Next.js Route Handlers (Node.js runtime), Server-Sent Events for streaming tools |
| Database | MongoDB through Mongoose 9 (one `Setting` key/value collection) |
| Authentication | None. Prompt editors use a password with HMAC-signed httpOnly cookies (`node:crypto`) |
| AI Services | LangChain (`@langchain/core`, `@langchain/google-genai`, `@langchain/openai`); Google Gemini as the primary model with Google Search grounding; OpenAI as the fallback model with the Responses API web search tool |
| Validation | Zod 4 (API input, environment, model output) |
| State Management | Custom module-level stores read with `useSyncExternalStore`, saved per tab in `sessionStorage` and mirrored to `localStorage` |
| Styling | Tailwind CSS 3.4, PostCSS, Autoprefixer, lucide-react icons, Inter via `next/font` |
| Deployment | No deployment configuration in the repo; standard `next build` / `next start` |
| Tooling | ESLint 9 with `eslint-config-next` |

## Project Structure

```
LinkPilot-AI/
├── public/                  # Logo (SVG source and 512px PNG)
├── src/
│   ├── app/
│   │   ├── <tool>/          # page.tsx (metadata) + *Client.tsx (UI) for each of the 8 tools
│   │   ├── global-prompts/  # Global AI Prompts page
│   │   ├── api/             # Route handlers (see API Reference)
│   │   ├── layout.tsx       # Root layout, metadata, JSON-LD
│   │   ├── page.tsx         # Redirects / to the first tool
│   │   └── sitemap.ts, robots.ts, manifest.ts
│   ├── components/
│   │   ├── ui/              # Sidebar, Header, ToolSwitcher, Modal, ResultCard, CopyButton, ...
│   │   ├── prompts/         # Shared prompt editor, tab strip and password gate
│   │   ├── dummy-data/      # Dummy Data dialog
│   │   ├── lead-signals/    # Lead signals table
│   │   └── <tool>/          # Tool-specific components
│   ├── config/              # env.ts (validated env vars, server-only), site.ts (name, logo)
│   ├── constants/           # Tone lists, limits and user-facing messages per tool
│   ├── data/                # Dummy data samples and the saved Trending Topics file
│   ├── hooks/               # Generation hooks for streaming tools, sidebar state, clipboard
│   ├── lib/                 # Tool stores, SSE helpers, validation, text and style checks
│   ├── models/              # Setting.ts, the only Mongoose model
│   ├── prompts/             # 65 default prompt templates (.md)
│   ├── services/            # Generation pipelines and shared AI services
│   │   └── <tool>/          # One folder per tool
│   └── types/               # Shared TypeScript types
├── next.config.ts           # Ships src/prompts and src/data with the API routes
├── tailwind.config.ts       # Material 3 style color tokens
└── .npmrc                   # legacy-peer-deps=true
```

## Architecture

### Frontend

Each tool page has two parts. A thin server `page.tsx` holds only the metadata and breadcrumb JSON-LD. A `"use client"` component builds the interface from the shared `Sidebar`, `Header` and result components.

Tool state doesn't live in component state. `createToolStore` in `src/lib/toolStore.ts` creates two stores per tool, one for the form and one for the result. Pages read them with `useToolStore`, so leaving a page keeps its inputs and any request in flight.

JSON tools call their route through `requestApi` in `src/lib/apiClient.ts`. Streaming tools read Server-Sent Events with `readSSEStream` in `src/lib/sse.ts`.

### Backend and API

Route handlers live under `src/app/api/`. Every handler validates its input with Zod and responds with a `{ success, message, data }` envelope. Error messages shown to users come from `UserFacingError` in `src/lib/errors.ts`; any other error returns a generic message, and details are logged on the server.

Two response styles are used:

- **JSON:** Connection Note, First Message, InMail, Follow-Up Message and Conversation Reply.
- **Server-Sent Events:** Trending Topics, Comment Writer and Post Comment Replies. These stream `{ status, text }` stage events, then a `COMPLETE` event with the result or an `ERROR` event. Comment Writer and Post Comment Replies take `multipart/form-data`, so a screenshot can be uploaded.

### Generation flow

A typical request goes through these steps:

1. The route validates the input.
2. The tool's service loads the saved prompt for the chosen tone from MongoDB, falling back to the default `.md` file.
3. The message is built in three layers:
   - locked application rules in the system message (`*-system.md`)
   - the saved tone prompt as the user's instructions
   - the pasted data inside delimiter tags

   `composePromptMessage` (`src/services/promptComposer.ts`) places each data block where the prompt uses its `{{variable}}` and appends any block the prompt doesn't place.
4. `generateStructuredWithFallback` (`src/services/ai.ts`) calls Gemini through LangChain structured output. It moves to OpenAI only if Gemini isn't configured, errors, times out (45 s by default), returns invalid output, or fails the tool's `validate` check.
5. Tool-specific checks run, with targeted rewrites where needed.
6. `humanizeTexts` (`src/services/humanizer.ts`) rewrites the final texts with the Humanization prompt and checks each rewrite on its own.
7. The route returns or streams the result.

Some tools add steps:

- **Screenshots** are transcribed first by `extractPostFromImage` (`src/services/postImage.ts`), with Gemini vision first and OpenAI as the fallback.
- **Live research** (`src/services/liveResearch.ts`) runs Gemini with Google Search grounding first. It resolves Google's redirect links to real URLs, and counts only grounding metadata as sources. If Gemini fails or finds too few sources, OpenAI web search runs instead. Trending Topics always researches, with one parallel pass per search lens. Comment Writer and Post Comment Replies research only when the saved prompt contains `{{research_context}}` or `{{web_research}}`.
- **Lead signals** (`src/services/leadSignals.ts`) run in parallel with the main generation at temperature 0. If they fail, the main result is still returned.

### Data storage

| Data | Where |
|---|---|
| Saved prompts, About Me, global prompts | MongoDB `Setting` collection, one document per key (e.g. `connection_note_prompt:professional`, `sender_profile`, `global_prompt:humanization`) |
| Default prompts | `src/prompts/*.md`, read at request time by `loadPrompt()` |
| Dummy data samples | `src/data/<kind>/<id>.md` |
| Latest Trending Topics search | `src/data/trending-topics/latest.md` (readable Markdown with the full result in a JSON block at the end) |
| Tool inputs and results | Browser `sessionStorage` per tab, plus `localStorage` for new tabs (`linkpilot:tool:<name>`, kept 24 hours) |

### Prompt editor access flow

1. The editor calls `GET /api/prompt-access`. The editor loads prompts only when the status is `unlocked`.
2. `POST /api/prompt-access` compares the password with `PROMPT_EDITOR_PASSWORD` using a constant-time check.
3. A correct password sets the `lp_prompt_session` cookie for 48 hours. Wrong attempts are counted in `lp_prompt_attempts`, and the third one locks the browser for 24 hours.
4. Both cookies are HMAC-signed with a key derived from the password, so changing the password ends every session.
5. Every prompt and dummy-data route calls `requirePromptAccess()` before doing anything else.

### External services

- **Google Gemini API:** text generation, vision, and Google Search grounding
- **OpenAI API:** fallback generation, vision, and web search through the Responses API
- **MongoDB:** local or Atlas

## Getting Started

### Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- npm (the repo ships a `package-lock.json`)
- A MongoDB database, local or MongoDB Atlas
- An API key for Google Gemini, OpenAI, or both. Gemini is the primary provider and OpenAI the fallback.

### Installation

```bash
git clone https://github.com/AbdulRafayDeveloper/LinkPilot-AI.git
cd LinkPilot-AI
npm install
```

`.npmrc` sets `legacy-peer-deps=true`, because the LangChain packages have conflicting peer ranges.

### Environment variables

Create `.env.local` in the project root. `src/config/env.ts` is the only place environment variables are read. There are no fallback values in code, and blank values count as unset. If a required variable is missing, the app refuses to start with an error that names it.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | Yes | Public origin of the app, used for canonical links, the sitemap, `robots.txt` and JSON-LD |
| `MONGODB_URI` | Yes | Saved prompts and the About Me profile |
| `PROMPT_EDITOR_PASSWORD` | No | Password for every Update Prompt and Dummy Data editor. When unset, editing is disabled |
| `GOOGLE_API_KEY` | No* | Gemini API key |
| `GEMINI_LIGHTWEIGHT_MODEL` | No* | Gemini model name |
| `OPENAI_API_KEY` | No* | OpenAI API key |
| `OPENAI_LIGHTWEIGHT_MODEL` | No* | OpenAI model name. It must support the Responses API `web_search` tool for research fallback |

\* A provider is used only when both its key and its model are set. At least one provider must be configured, or every generation fails with a configuration error.

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/linkpilot_ai
PROMPT_EDITOR_PASSWORD=choose_a_long_random_password

GOOGLE_API_KEY=your_google_gemini_api_key
GEMINI_LIGHTWEIGHT_MODEL=gemini-2.5-flash

OPENAI_API_KEY=your_openai_api_key
OPENAI_LIGHTWEIGHT_MODEL=gpt-4o-mini
```

Gemini 1.5 models have been retired and return 404. The free Gemini tier also has a small daily request quota. Once it's used up, every call falls back to OpenAI.

### Running locally

```bash
npm run dev
```

Open http://localhost:3000. Next.js 16 allows only one `next dev` per project folder.

Before the first real use:

1. Set `PROMPT_EDITOR_PASSWORD`, then open **First Message → Update Prompt → About Me (sender)** and describe yourself. Until you do, the tools treat About Me as empty and avoid making any claims about you.
2. For Post Comment Replies, fill in **Rafay Profile Info** on the Global AI Prompts page.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (Turbopack) |
| `npm run build` | Create a production build (`build.bat` runs the same command) |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint (flat config) |
| `npx tsc --noEmit` | Type-check the project (no script is defined for it) |

There is no automated test suite. To verify changes, call the API routes or use the pages against a running server.

## API Reference

All routes return `{ success, message, data }`, except the streaming routes, which return `text/event-stream`. Routes marked 🔒 require an unlocked prompt session.

| Method | Route | Description |
|---|---|---|
| POST | `/api/trending-topics/search` | Run a new search (SSE). A search that finds topics replaces the saved result |
| GET, DELETE | `/api/trending-topics/saved` | Load or remove the saved search |
| GET, PUT 🔒 | `/api/trending-topics/prompt` | Read or save the research brief |
| POST | `/api/connection-notes/generate` | `{ profileData, tone }` |
| POST | `/api/first-messages/generate` | `{ profileData, tune }` |
| POST | `/api/inmail-messages/generate` | `{ profileData, tune }` |
| POST | `/api/comment-writer/generate` | Multipart form: `tune`, `inputMode`, `postText` or `image` (SSE) |
| POST | `/api/post-comment-replies/generate` | Multipart form: `context`, `style`, `comments`, `inputMode`, `postText` or `image` (SSE) |
| POST | `/api/follow-up-messages/generate` | `{ conversation, profileData?, followUpType }` |
| POST | `/api/conversation-replies/generate` | `{ conversation, profileData?, replyType }` |
| GET 🔒 | `/api/<tool>/prompts` | All prompts for a tool |
| PUT 🔒 | `/api/<tool>/prompts/<id>` | Save one prompt (Post Comment Replies uses `/prompts/<context>/<style>`) |
| GET 🔒 | `/api/global-prompts` | Humanization and Rafay Profile Info prompts |
| PUT 🔒 | `/api/global-prompts/<id>` | Save one global prompt |
| GET, POST 🔒 | `/api/dummy-data/<kind>` | List or create samples |
| PUT, DELETE 🔒 | `/api/dummy-data/<kind>/<id>` | Update or delete a sample |
| GET, POST | `/api/prompt-access` | Check the editor status or submit the password |

## Customizing prompts

- Default prompts are in `src/prompts/`. Each tone file is named after its tool and tone id, e.g. `connection-note-professional.md` or `post-comment-reply-my-post-authority-builder.md`. The `*-system.md` files hold each tool's locked rules.
- Tone prompts can place data with `{{variable}}` placeholders. Any block a prompt doesn't place is appended.

| Tool | Variables |
|---|---|
| Connection Note | `{{profile_data}}`, `{{tone}}` |
| First Message, InMail | `{{profile_data}}`, `{{sender_profile}}`, `{{tune}}` |
| Comment Writer | `{{post_content}}`, `{{selected_tune}}`, `{{user_experience}}` (About Me), `{{research_context}}` (runs live research) |
| Post Comment Replies | `{{conversation}}`, `{{post_content}}`, `{{latest_comment}}` / `{{comment}}`, `{{sender_profile}}`, `{{web_research}}` (runs live research) |
| Follow-Up Message | `{{conversation}}`, `{{profile_data}}`, `{{follow_up_type}}` |
| Conversation Reply | `{{conversation}}`, `{{profile_data}}`, `{{sender_profile}}`, `{{conversation_analysis}}`, `{{reply_type}}` |

- To add a tone, add an entry to the tool's list in `src/constants/<tool>.ts` and create its default template in `src/prompts/`. The pipeline doesn't need changes.

## Deployment

The repository has no Dockerfile, CI workflow or hosting configuration. Deploy it like any Next.js app:

```bash
npm run build
npm run start
```

Things to plan for:

- **Environment:** set all variables from the table above on the host, and point `NEXT_PUBLIC_BASE_URL` at the public URL.
- **Bundled files:** `next.config.ts` includes `src/prompts/**` and `src/data/**` in the API routes' output, because both are read from disk at runtime.
- **Writable file system:** Dummy Data editing and the saved Trending Topics file write to `src/data/`. On a read-only host, such as most serverless platforms, those writes fail with a clear message, while generation still works.
- **Long-running routes:** the research and analysis routes set `maxDuration` to 300 seconds, and the other generate routes to 120 seconds. The host's function time limit needs to allow that.
- **Upload size:** screenshots are capped at 4 MB, which keeps requests under Vercel's 4.5 MB body limit.
