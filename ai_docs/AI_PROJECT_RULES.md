# AI Project Development Rules & Standards

These rules are mandatory for every change made to this project.

The AI must NEVER ignore these rules.

----------------------------------------------------
1. GENERAL PRINCIPLES
----------------------------------------------------

• Always prioritize clean architecture.
• Never duplicate code.
• Keep the project scalable.
• Keep the project maintainable.
• Keep the project modular.
• Follow SOLID principles.
• Follow DRY.
• Follow KISS.
• Follow YAGNI.
• Prefer composition over inheritance.
• Every file should have a single responsibility.
• Never leave unused code.
• Never leave commented production code.
• Never use "any" unless absolutely necessary.
• Never create technical debt.

----------------------------------------------------
2. NEXT.JS STANDARDS
----------------------------------------------------

• Use App Router.
• Use TypeScript everywhere.
• Use Server Components by default.
• Use Client Components only when necessary.
• Keep page.tsx lightweight.
• Business logic must never live inside page.tsx.
• Use layouts correctly.
• Use loading.tsx.
• Use error.tsx.
• Use not-found.tsx.
• Use route groups when appropriate.
• Use metadata API.
• Optimize SEO.
• Use dynamic metadata where required.

----------------------------------------------------
3. FOLDER STRUCTURE
----------------------------------------------------

Use a consistent folder structure.

app/
components/
features/
hooks/
lib/
services/
actions/
types/
constants/
utils/
config/
providers/
store/
middleware/
styles/
public/

----------------------------------------------------
4. COMPONENT RULES
----------------------------------------------------

Components should:

• Have one responsibility.
• Be reusable.
• Be small.
• Avoid unnecessary props.
• Avoid prop drilling.
• Use composition.
• Be strongly typed.
• Keep UI separate from logic.

----------------------------------------------------
5. SERVER ACTIONS
----------------------------------------------------

• Keep server actions isolated.
• Validate all inputs.
• Return consistent responses.
• Never expose secrets.
• Handle all errors.

----------------------------------------------------
6. API DESIGN
----------------------------------------------------

• Validate every request.
• Return proper HTTP status codes.
• Standardize API responses.
• Never expose stack traces.
• Handle unexpected errors gracefully.
• Use centralized error handling.

----------------------------------------------------
7. DATABASE
----------------------------------------------------

• Proper indexing.
• Avoid duplicate queries.
• Use transactions where needed.
• Optimize queries.
• Avoid N+1 queries.
• Keep schemas normalized.
• Add proper validation.

----------------------------------------------------
8. AUTHENTICATION
----------------------------------------------------

• JWT or secure session.
• HttpOnly cookies.
• Secure cookies.
• CSRF protection.
• RBAC.
• Route protection.
• Middleware protection.

----------------------------------------------------
9. SECURITY
----------------------------------------------------

Never expose:

API Keys
Secrets
Tokens
Passwords
Private URLs

Always:

Validate input
Sanitize input
Escape output
Rate limit APIs
Protect against XSS
Protect against CSRF
Protect against SQL Injection
Protect against NoSQL Injection
Protect against SSRF
Protect against DOS attacks

----------------------------------------------------
10. ENVIRONMENT VARIABLES
----------------------------------------------------

Every environment variable must:

Exist in

.env.example

Be documented.

Never hardcode secrets.

----------------------------------------------------
11. ERROR HANDLING
----------------------------------------------------

Every async function must have proper error handling.

Create reusable error helpers.

Log useful information.

Never crash the application.

----------------------------------------------------
12. LOGGING
----------------------------------------------------

Use structured logging.

Never log:

Passwords
Tokens
Secrets
Personal information

----------------------------------------------------
13. PERFORMANCE
----------------------------------------------------

Lazy loading

Dynamic imports

Caching

Image optimization

Font optimization

Bundle optimization

Code splitting

Streaming

Pagination

Infinite scrolling where appropriate

Debouncing

Memoization

Virtualization for large lists

----------------------------------------------------
14. NEXT IMAGE
----------------------------------------------------

Always use next/image.

Never use plain img unless necessary.

----------------------------------------------------
15. TYPESCRIPT
----------------------------------------------------

Strict Mode enabled.

No implicit any.

Proper interfaces.

Reusable types.

Avoid duplicate types.

----------------------------------------------------
16. REACT
----------------------------------------------------

Use hooks correctly.

Avoid unnecessary state.

Avoid unnecessary re-renders.

Memoize expensive operations.

Proper dependency arrays.

----------------------------------------------------
17. STATE MANAGEMENT
----------------------------------------------------

Choose the simplest solution.

Context

Zustand

Redux

TanStack Query

Use only when appropriate.

----------------------------------------------------
18. FORMS
----------------------------------------------------

Use:

React Hook Form

Zod validation

Client validation

Server validation

----------------------------------------------------
19. CODE STYLE
----------------------------------------------------

Meaningful names.

Readable code.

Consistent formatting.

Small functions.

No magic numbers.

No duplicated logic.

----------------------------------------------------
20. AI INTEGRATIONS
----------------------------------------------------

OpenAI

LangChain

LangGraph

Anthropic

Gemini

DeepSeek

Ollama

Rules:

Never expose API keys.

Keep prompts in dedicated files.

Version prompts.

Log AI errors.

Retry transient failures.

Support streaming.

Support cancellation.

Set timeouts.

Validate AI responses.

Sanitize AI outputs.

Cache expensive responses.

Track token usage.

Track costs.

Separate prompts from business logic.

----------------------------------------------------
21. RAG SYSTEMS
----------------------------------------------------

If using RAG:

Separate embedding layer.

Separate retrieval layer.

Chunk correctly.

Store metadata.

Version embeddings.

Support re-indexing.

----------------------------------------------------
22. VECTOR DATABASES
----------------------------------------------------

Keep vector DB isolated.

Store metadata.

Track embedding versions.

----------------------------------------------------
23. FILE UPLOADS
----------------------------------------------------

Validate type.

Validate size.

Virus scan if possible.

Store securely.

Generate signed URLs.

----------------------------------------------------
24. EMAILS
----------------------------------------------------

Templates.

Queue emails.

Retry failures.

Track delivery.

----------------------------------------------------
25. PAYMENTS
----------------------------------------------------

Verify webhooks.

Idempotency.

Logging.

Secure validation.

----------------------------------------------------
26. SOCKETS
----------------------------------------------------

Reconnect handling.

Authentication.

Cleanup listeners.

Prevent memory leaks.

----------------------------------------------------
27. TESTING
----------------------------------------------------

Unit tests.

Integration tests.

E2E tests.

API tests.

----------------------------------------------------
28. DOCUMENTATION
----------------------------------------------------

README

Architecture

API documentation

Environment setup

Deployment guide

----------------------------------------------------
29. GIT
----------------------------------------------------

Meaningful commits.

No generated files.

No secrets.

Small PRs.

----------------------------------------------------
30. DEPLOYMENT
----------------------------------------------------

Production ready.

Zero console errors.

Zero TypeScript errors.

Zero ESLint errors.

Optimized build.

Environment validated.

Health checks.

----------------------------------------------------
31. FINAL RULE
----------------------------------------------------

Every change made to this project must improve:

Readability

Maintainability

Scalability

Performance

Security

Developer Experience

User Experience

No code should be merged if it violates these rules.