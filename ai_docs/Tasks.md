# LinkPilot AI - Task Checklist

This checklist breaks down the implementation plan into sequential, manageable development steps. Each task contains complete details on affected files, changes, edge cases, and architectural solutions.

---

## Phase 1: Database & System Setup

- [x] **Task 1: Package Installations & Environment Verification (✅ Complete)**
  - **Description**: Installs LangChain and target AI packages: `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/google-genai`, `@langchain/community`. Installs vector database helper libraries (`chromadb`), validation schemas (`zod`), and file parsing tools (`pdf-parse`, `mammoth`, `cheerio`, `csv-parser`). Verifies `.env.example` configurations and confirms local `.env.local` contains correct connection URIs.
  - **Files Affected**: `package.json`, `.env.local`
  - **Edge Cases & Solutions**:
    - *Missing required environment variables at runtime*: Implement strict env validation on startup using Zod schema, crashing early with helpful error logs if any required keys are missing.
    - *API key changes at runtime*: Access values lazily via `process.env` instead of storing them in module-level constants.

- [x] **Task 2: Database Connection & Metadata Model Schema (✅ Complete)**
  - **Description**: Creates the MongoDB connection manager client in `src/lib/db.ts` using connection pooling techniques. Creates the `Document` Mongoose model schema in `src/models/Document.ts` to catalog indexed items, storing metadata fields: name, type, size, chunks count, status ("Ready" | "Processing" | "Error"), upload date, preview text, and search tags.
  - **Files Affected**: `src/lib/db.ts`, `src/models/Document.ts`
  - **Edge Cases & Solutions**:
    - *Multiple connection attempts causing connection leaks in development*: Implement global cache pattern (`global.mongoose`) to reuse existing connection across server reloads.
    - *Network timeout on initial connection*: Configure Mongoose option `serverSelectionTimeoutMS: 5000` to fail fast and log clear DB offline traces.

- [x] **Task 3: Document Parsing Service (✅ Complete)**
  - **Description**: Creates `src/services/parser.ts` to extract raw text content from multiple formats: PDFs using `pdf-parse`, Word DOCX documents using `mammoth`, TXT and Markdown files using Node.js stream readers, and JSON data trees and CSV tables using parsing handlers. Validates file extensions and limits inputs to prevent memory leaks during processing.
  - **Files Affected**: `src/services/parser.ts`
  - **Edge Cases & Solutions**:
    - *Corrupt or zero-byte file uploads*: Throw immediate validation exceptions for zero-byte sizes or unparseable headers.
    - *Password-protected PDFs*: Catch PDF parsing library decrypt errors, set status to `Error`, and report "Unreadable: Password Protected".

---

## Phase 2: Vector Indexing & Knowledge Base APIs

- [x] **Task 4: Text Splitter & Vector Indexing Service (✅ Complete)**
  - **Description**: Creates `src/services/vectorstore.ts` using LangChain Character Text Splitters to chunk raw text into chunks of 500 characters with 100-character overlaps. Integrates OpenAI/Gemini embedding models to translate text chunks into vector representations. Connects to ChromaDB to index vector matrices, preserving metadata links (Document Name, Chunk ID, category type, source page).
  - **Files Affected**: `src/services/vectorstore.ts`
  - **Edge Cases & Solutions**:
    - *Text longer than max token context of the embedding model*: Enforce recursive split size limits under 500 characters to stay within token dimensions.
    - *Rate limits or timeouts on embedding API calls*: Implement LangChain retry triggers with exponential backoff on transient HTTP 429/500 errors.

- [x] **Task 5: Document Management APIs (✅ Complete)**
  - **Description**: Creates `/api/knowledge` API routes under `src/app/api/knowledge/route.ts` supporting `GET` to query the MongoDB `Document` collection, and `POST` to manage file upload streams. Runs text parsers, splits chunks, computes embeddings, indexes ChromaDB vectors, and saves document records in MongoDB.
  - **Files Affected**: `src/app/api/knowledge/route.ts`
  - **Edge Cases & Solutions**:
    - *Duplicate document name uploads*: Append a short unique random UUID suffix to the name before writing.
    - *Simultaneous file uploads*: Process uploads asynchronously with promise wrappers to prevent main thread blocking.

- [x] **Task 6: Document Deletion API (✅ Complete)**
  - **Description**: Creates `/api/knowledge/[id]/route.ts` route handlers supporting `DELETE` to identify the target document record, drop the MongoDB metadata record, and purge all corresponding indexed chunks from ChromaDB.
  - **Files Affected**: `src/app/api/knowledge/[id]/route.ts`
  - **Edge Cases & Solutions**:
    - *Document deleted from MongoDB but deletion fails in ChromaDB*: Use database transactional integrity checks—verify ChromaDB purges before deleting metadata from MongoDB, or retry on fail.

- [x] **Task 7: Dynamic Knowledge Base UI Integration (✅ Complete)**
  - **Description**: Refactors `src/app/knowledge-base/KnowledgeBaseClient.tsx` to fetch documents dynamically from `/api/knowledge`. Connects the upload file dialog modal to trigger `POST /api/knowledge` requests with progress indicator bars. Links row deletion triggers to hit the `DELETE /api/knowledge/[id]` endpoints.
  - **Files Affected**: `src/app/knowledge-base/KnowledgeBaseClient.tsx`
  - **Edge Cases & Solutions**:
    - *Table lists hundreds of documents, slowing down the UI*: Implement pagination and lazy-loading lists in the grid.
    - *Deleting an item currently selected in the details panel*: Reset `selectedDoc` state to the next available document or `null` if the table is empty.

---

## Phase 3: AI Orchestration & Chat Pipeline

- [x] **Task 8: Dynamic Prompt Templates Loader (✅ Complete)**
  - **Description**: Establishes a prompt template manager utility in `src/services/prompts.ts` to dynamic-load prompts from Markdown template files: `src/prompts/system.md` (role constraints), `src/prompts/router.md` (router classifier metrics), and `src/prompts/agent.md` (agent tool syntax configurations).
  - **Files Affected**: `src/services/prompts.ts`, `src/prompts/system.md`, `src/prompts/router.md`, `src/prompts/agent.md`
  - **Edge Cases & Solutions**:
    - *Prompt file not found or corrupted*: Fallback to hardcoded safe prompts if loading template markdown files fails.

- [x] **Task 9: Model Provider Factory & Complexity Router (✅ Complete)**
  - **Description**: Creates a model factory in `src/services/ai.ts` wrapping model instantiation. Implements the classifier logic: analyzes input queries to determine complexity. Simple queries (FAQs, welcome requests) run on lightweight models (Gemini Flash / GPT-4o-mini). Complex queries (debug traces, billing calculations) run on premium models (GPT-4o / Gemini Pro).
  - **Files Affected**: `src/services/ai.ts`
  - **Edge Cases & Solutions**:
    - *Routed model is offline or has depleted quota*: Catch API exceptions and fallback dynamically to alternative models (e.g., fallback from OpenAI to Gemini or vice-versa).

- [x] **Task 10: RAG Context Search Pipeline (✅ Complete)**
  - **Description**: Creates `src/services/rag.ts` to compute query embeddings, search ChromaDB for the top 5 most similar chunks, and filter them using similarity score thresholds. Compiles retrieved context blocks into the final system prompt.
  - **Files Affected**: `src/services/rag.ts`
  - **Edge Cases & Solutions**:
    - *Zero matched document chunks*: Return a clean system message stating that no context was retrieved, instructing the LLM to reply using general knowledge.

- [x] **Task 11: Agentic Tools Execution Handler (✅ Complete)**
  - **Description**: Creates tool definitions in `src/services/tools.ts` matching functions (Create Ticket, Update Ticket, Escalate, Close Ticket). Formats tool arguments, runs mock service executions, and returns structured JSON responses detailing execution progress.
  - **Files Affected**: `src/services/tools.ts`
  - **Edge Cases & Solutions**:
    - *Tool parameter validation failures*: Return tool execution status as `Error` containing Zod schema validation errors.

- [x] **Task 12: Chat API Handler (Streaming) (✅ Complete)**
  - **Description**: Creates the `/api/chat` route handler under `src/app/api/chat/route.ts` to validate inputs (Zod scopes) and security checks (inject block flags), retrieve memory history files, run RAG context searches, classify complexity and route to the selected LLM provider, and stream generated tokens back to the client using Server-Sent Events (SSE).
  - **Files Affected**: `src/app/api/chat/route.ts`
  - **Edge Cases & Solutions**:
    - *Client disconnects mid-stream*: Listen to client request close events (`req.signal.addEventListener("abort", ...)`) and abort the LLM stream.

- [x] **Task 13: Dynamic Chat Welcome page UI Integration (✅ Complete)**
  - **Description**: Refactors `src/app/WelcomeClient.tsx` to handle streaming chat completion tokens. Connects suggestion pills to auto-populate chat inputs. Links the composer tools dropdown actions to execute web searches.
  - **Files Affected**: `src/app/WelcomeClient.tsx`
  - **Edge Cases & Solutions**:
    - *User sends empty spaces or newlines*: Disable submit triggers if trimmed content is empty.

---

## Phase 4: Operations Metrics & Tracing

- [x] **Task 14: Analytics KPI & Trends APIs (✅ Complete)**
  - **Description**: Creates the `/api/analytics` route handler under `src/app/api/analytics/route.ts` to query token trace metrics to aggregate KPI cards (tokens used, costs, response latency averages, request counts), and return historical timeline datasets mapping daily conversation volumes and active model provider distributions.
  - **Files Affected**: `src/app/api/analytics/route.ts`
  - **Edge Cases & Solutions**:
    - *Zero historical conversation logs (empty database stats)*: Return baseline default zero metrics instead of throwing null errors.

- [x] **Task 15: Dynamic Analytics UI Charts & Logs Terminal (✅ Complete)**
  - **Description**: Refactors `src/app/analytics/AnalyticsClient.tsx` to query live analytics telemetry metrics, map datasets to render usage trend curves, donut segments, and bar charts, and stream real-time API request log notifications into the dashboard logs console.
  - **Files Affected**: `src/app/analytics/AnalyticsClient.tsx`
  - **Edge Cases & Solutions**:
    - *Terminal log list grows indefinitely, causing memory bloat*: Cap the logs list state to the latest 50 records.

- [x] **Task 16: Inspector Tracing API Route (✅ Complete)**
  - **Description**: Creates `/api/inspector` route handler under `src/app/api/inspector/route.ts` to return execution timeline lifecycle traces for a specific trace ID (durations, injection check outputs, memory payloads, matched RAG references, routing parameters, and tool execution stdout).
  - **Files Affected**: `src/app/api/inspector/route.ts`
  - **Edge Cases & Solutions**:
    - *Requested trace ID does not exist*: Return HTTP 404 with a structured error envelope.

- [x] **Task 17: Interactive Trace Timeline UI integration (✅ Complete)**
  - **Description**: Refactors `src/app/inspector/InspectorClient.tsx` to bind conversation selection search inputs to query `/api/inspector?traceId=...`. Renders execution steps in an interactive timeline stepper and displays standard output logs, code parameters, and RAG context blocks in sidebar code viewers.
  - **Files Affected**: `src/app/inspector/InspectorClient.tsx`
  - **Edge Cases & Solutions**:
    - *Searching for a trace ID that does not exist*: Show a clear error banner inside the UI advising the user that the trace is invalid.

---

## Phase 5: UI/UX State & Client Optimizations

- [x] **Task 18: Homepage Chat Thread UI Transition & Render (✅ Complete)**
  - **Description**: Refactors `src/app/WelcomeClient.tsx` to transition dynamically from the greeting welcome suggestions view to an active scrollable chat bubble thread layout upon message submission, supporting message history arrays and streaming token outputs.
  - **Files Affected**: `src/app/WelcomeClient.tsx`
  - **Edge Cases & Solutions**:
    - *Long continuous message strings causing message bubble layouts to break container limits*: Apply `break-words whitespace-pre-wrap max-w-[80%]` styling values.
    - *Autoscrolling doesn't trigger on new message or streamed token events*: Implement a DOM reference (`messagesEndRef`) and execute `scrollIntoView({ behavior: 'smooth' })` inside a `useEffect` hook.

- [x] **Task 19: Sidebar Collapsible State Global Persistence (✅ Complete)**
  - **Description**: Configures collapsible sidebar layout states across all client views (`WelcomeClient.tsx`, `KnowledgeBaseClient.tsx`, `AnalyticsClient.tsx`, `InspectorClient.tsx`) to read and write from `localStorage`, ensuring that collapsing the panel persists when navigating between routes.
  - **Files Affected**: `src/components/ui/Sidebar.tsx`, page client wrappers.
  - **Edge Cases & Solutions**:
    - *Server-side rendering (SSR) hydration mismatches*: Enclose `localStorage` query references inside React `useEffect` hooks checking that `window` object availability is confirmed.

- [x] **Task 20: Knowledge Base File Selection Previews & MIME Validation (✅ Complete)**
  - **Description**: Adds pre-upload file list rendering in the upload dialog, displaying names and sizes of files prior to submission.
  - **Files Affected**: `src/app/knowledge-base/KnowledgeBaseClient.tsx`
  - **Edge Cases & Solutions**:
    - *User uploads invalid file formats*: Implement strict file input type filters on the client element (`accept=".pdf,.docx,.txt,.json,.md,.csv"`) and validate MIME profiles during selection.
