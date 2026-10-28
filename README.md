# LinkPilot AI

**Outreach & Client Workspace.** A private Next.js app that writes LinkedIn copy, keeps client work in one place and runs the day's own work: tasks, notes, files, meetings and prompts. Every page needs a signed-in account; nothing is ever posted or sent from the app, it writes the text and you send it yourself.

## What is in it

The sidebar has four areas, plus Administration for admins.

### LinkedIn Tools

| Tool | Route | What it writes |
|---|---|---|
| Comment Writer | `/comment-writer` | A comment on a post (pasted text or a screenshot), 8 tunes, with a Profile Scheduler for the people worth commenting on |
| Post Comment Replies | `/post-comment-replies` | A reply to the latest comment, 2 contexts × 7 styles |
| InMail Composer | `/inmail-message` | A subject and message from a profile, as text or a voice-note script |
| Follow-Up Message | `/follow-up-message` | A follow-up from a pasted conversation, with a lead signals table |
| First Message | `/first-message` | A first DM from a profile, as text or a voice-note script (ABCD Method by default) |
| Connection Note | `/connection-note` | A connection note of at most 300 characters, 8 tones. The app opens here |
| Conversation Reply | `/conversation-reply` | An analysis of a conversation and the next reply |
| Trending Topics | `/trending-topics` | Six fresh, source-backed topics from live web research, each with a ready post |
| Post Image Creator | `/post-image-creator` | A post image in your own brand colours, with your own photo |

Every text tool keeps what it wrote on its own "view all" page (`/<tool>/history`), with search, filters and bulk delete, and every result can be edited in place before you copy it.

### Workspace

Prompt Creator (a spoken or typed task turned into a prompt for a coding agent or AI search), Daily Tasks, Message Rewriter, Important Content, Temporary Quick Notes (with speech to text), Employees Management (with a private plan link per employee), Personal Drive (your files in S3, in nested folders) and Activity Logs.

### Client Work

Meeting Scheduler & Planner (a calendar with an AI-written preparation and a chat over each meeting), Client Voices to Tasks (client voice notes turned into transcripts, tasks and questions), Meeting Notes to Tasks (a transcript of any length, or a meeting recorded in the app, turned into notes and tasks, shareable by a read-only link), Client Tasks Messaging, Reference Content, Clients Management and Client Projects (every project's changes, ideas, backlog, links, documents and more under tabs, with a link the client writes on without signing in).

### Finance

Budget Management and Investment Plans, both coming soon.

### Administration (admins only)

Audit Management, User Management (accounts, what each one made, which tools each may use, deleting an account), AI Model Priority (the model order per module, usage and cost), Database Backup (weekly to cloud storage, or on demand), Dummy Data for Testing and Global AI Prompts (where every prompt is edited).

Also: **My AI Profile** (`/global-prompts`, each person's own background the tools write from), **Account Settings** (`/account`: name, photo, password, time zone, light or dark) and **Help** (`/help`, readable without signing in).

## How it works

- **AI providers.** Groq is the primary provider for every module, with any number of keys that take turns; an open-source model on any OpenAI-compatible server and then OpenAI take over when Groq can't answer. Speech is read with Whisper (Groq, then OpenAI), images are drawn with OpenAI's image model, meeting vectors use OpenAI embeddings and My AI Profile vectors use Gemini embeddings. Every result says which provider wrote it, and every call is counted and priced.
- **Prompts live in MongoDB, never in code.** Each tone, tune and style has its own prompt, and only an admin edits them, from Administration → Global AI Prompts. Every LinkedIn tool's final text goes through a humanizing pass and a set of checks against invented facts.
- **Accounts.** Two roles: a user sees only what their account made, an admin sees everything and the admin area. Sessions are signed cookies; every API route checks the account, its role and the tools it may use.
- **Storage.** MongoDB (`LinkPilot` database) holds every record; files, recordings and images are in a private S3 bucket and are only ever served through short-lived signed links.

## Tech stack

Next.js 16 (App Router, Turbopack), React, TypeScript (strict), Tailwind CSS with Material 3 colour tokens and a light and dark scheme, MongoDB with Mongoose, LangChain, Groq and OpenAI SDKs, AWS S3, Zod, dnd-kit. Deployed on Vercel.

## Getting started

### Prerequisites

- Node.js 24 (`>=24.22.1 <25`, see `engines` in `package.json`)
- A MongoDB database (Atlas, for the vector search the meeting chat and My AI Profile use)
- At least one Groq API key

### Install and run

```bash
npm install          # .npmrc sets legacy-peer-deps=true, which LangChain's peer ranges need
# create .env.local with the variables below
npm run dev          # http://localhost:3000
```

### Environment variables

Every variable is read and checked in one place, `src/config/env.ts`. A missing required one stops the app with an error that names it; nothing has a default in code.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_BASE_URL`, `MONGODB_URI`, `AUTH_SECRET` | **Required.** The public origin, the database, and the key that signs sessions and shared links |
| `GROQ_API_KEY_1` (… `_n`), `GROQ_MODEL` | **Required.** The primary provider. Add keys from different Groq accounts for more capacity |
| `GROQ_VISION_MODEL`, `GROQ_TRANSCRIPTION_MODEL` | Screenshots and speech on Groq |
| `OPEN_SOURCE_BASE_URL`, `OPEN_SOURCE_MODEL`, `OPEN_SOURCE_API_KEY` | The open-source fallback (optional) |
| `OPENAI_API_KEY`, `OPENAI_LIGHTWEIGHT_MODEL` | The last fallback, plus web search and screenshots |
| `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_IMAGE_MODEL` | Speech fallback, the meeting chat, Post Image Creator |
| `GEMINI_API_KEY_1` (… `_n`), `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSIONS` | Searching My AI Profile |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` | Every file, recording and image |
| `CRON_SECRET` | The weekly database backup |
| `ALLOW_SIGNUP` | `"true"` opens `/signup` for user accounts |

A module whose optional variables are missing says so on its page and the rest of the app carries on. `GET /api/ai-status` reports what a deployment is configured for, without ever showing a value.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint
npx tsc --noEmit # type check
```

## Deployment

Production is built by Vercel from the `main` branch: a push to `main` deploys. The weekly backup runs from the cron entry in `vercel.json`. Accounts, the prompts in the database and data migrations are set up by the owner and are not part of this repository.
