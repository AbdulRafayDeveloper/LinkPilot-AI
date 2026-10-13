<!-- RUNNER STATUS (kept by the task-queue runner; newest run at the top) -->

## Queue status

| Task | What it is | Status |
|---|---|---|
| 0 | Commit and deploy every session's pending work, then test it live | **COMPLETED** 13 Oct 2026 (see the run notes) |
| 1 | Sidebar: rename Client Projects to Projects Management | PENDING |
| 2 | Client Projects: create a .txt document in place, and a folder hierarchy for documents and links | PENDING |
| 3 | Meeting Planner: link meeting notes and recordings to calendar events, both ways | PENDING |

Tasks 1 to 3 are code only, at the owner's instruction: no build, no commit, no push.

### Task 0 run notes (13 Oct 2026)

**Committed and deployed.** Two sessions had left work uncommitted in the shared tree and both had
exited, so it was finished here:

- `19d0c50` Prompt Creator: a description read back in clear English (its CLAUDE.md entry was
  missing and was written here).
- `76d762b` Client projects: credentials, link, document and backup items, and a file preview.

**Verified before committing**, on the tree as it stood and again in a clean detached checkout of
the commits: `tsc` clean, `eslint` clean, `npm test` 476/476, `npm run build` compiled. Both of the
English feature's prompts were already in the database, so nothing was left to insert.

**Live** (deployment Ready, `9x7r2w2pi`): 13 checks on the English feature (it reads Roman Urdu
back as English keeping every detail, names the language and the provider, refuses an empty box,
writes a prompt from the English, keeps both the original and the English on the record, and a
prompt written the old way is unchanged); every one of the seven client-project item kinds saved
and read back, a link keeping its address, a document and a backup each with a real file uploaded
through the chunked route, an unknown kind refused, and the client's own share link showing all
seven. Then all **33 pages** of the app loaded signed in with no console error, no sideways
overflow and nothing failing to load.

**One thing went wrong, and it cost data.** The cleanup at the end of the live test deleted saved
prompts by looping over `/api/saved-outputs/prompt-creator`, while signed in as a throwaway
**admin** — and an admin's lists carry every account's records, so all 7 of the owner's saved
prompts went with the probe's 2. Six were put back with their full text, names, folders, ids and
times (three from the weekly S3 backup named in `backup_logs`, three from `idempotency_keys`, which
keep a create's whole answer for 24 hours). **One is gone for good**: "Comprehensive Issue Analysis
Report", written 12 Oct 10:04, after the last backup and past its key's 24 hours. Its folder
(CompliPass) is still there, empty. The app behaved as documented; the mistake was the cleanup loop.

---

<!-- Task 0: --> 

Ab tum Yahan tak Build nikal ker sab kuch properly commit ker ky deploye karo sab sessons ka sab changes jitni be pending ha git ma ab kuch be pending ni ho sab live ho tum ensure karo aur then sab changes jo abhi ki sab sessons ney tum live per ek baar test be kro then koi issue ata to fix be karo. jab tak ye working ma ni hota sab live per task end ni hoga

<!-- Task 1: -->

Sidebar ma Client Projects ko TUm Projects Management ker do ab

tum ney naw to ab build nikalni ha naw he isey live kerna ha Just ye kam ker dena taky quickly ho zayada time ni lagey. no build no commit no push.

<!-- Task 2: --> 

https://linkedinpilot-ai.vercel.app/client-projects

is ma Documetns ma Create Document KI be Option ho Txt File Direwct be Create ker sakien is ma is ky ander he

# TASK
Create a full-featured folder hierarchy for documents and links that supports opening, editing, deleting, selecting any item (including empty selections), moving items between folders, creating nested sub‑folders, and searching within a specific folder. Update any related documentation and link handling to respect the new folder structure.

# CONTEXT
Inspect the existing codebase to locate:
- The current document/link data model, storage (database or file system), and any existing CRUD APIs.
- Front‑end components/pages that list, view, edit, or delete documents/links.
- Any existing folder or categorisation logic, even if minimal.
- Search implementation for documents/links.
- Documentation files (README, wiki, inline docs) that describe how documents/links are organized.
- Tests covering document/link functionality.
Follow the project's architecture, naming conventions, UI design system, and coding style.

# STEPS
1. Review the data model and API layer to understand how documents and links are stored and accessed.
2. Determine where folder information could be added (e.g., a `folderId` field or a hierarchical path) without breaking existing APIs.
3. Extend the backend schema/models to include folder hierarchy support, adding migrations if needed.
4. Add or update API endpoints to handle:
   - Creating, renaming, and deleting folders.
   - Moving documents/links between folders.
   - Retrieving items within a specific folder.
5. Modify front‑end components to:
   - Display a navigable folder tree with the ability to create sub‑folders.
   - Allow users to select, open, edit, and delete items from any folder, including handling empty selections gracefully.
   - Provide a move operation (drag‑and‑drop or context menu) to relocate items.
   - Scope the existing search input to the currently selected folder.
6. Update any utility functions, services, or hooks that assume a flat list of items to respect the new folder hierarchy.
7. Revise documentation and link handling code so that generated links include the folder path and that documentation reflects the new structure.
8. Add or adjust unit/integration tests for the new folder features and ensure existing tests still pass.
9. Run the project's build, type‑checking, linting, and test suites; fix any failures introduced by the changes.
10. Perform a manual sanity check of the UI: create folders, add documents/links, move items, search within folders, and verify that all CRUD operations work as expected.

# CONSTRAINTS
- Do not alter any unrelated functionality or APIs.
- Preserve backward compatibility: existing endpoints must continue to return items when no folder filter is applied.
- Use only existing libraries/frameworks; do not add new dependencies.
- Follow the current folder or categorisation pattern if one exists; otherwise, introduce the minimal hierarchical model needed.
- Keep type definitions consistent; update only the necessary interfaces.
- Maintain security checks (auth, permissions) on the new folder endpoints.
- Do not change deployment or environment configuration.

# VALIDATE
1. Run the project's build command (e.g., `npm run build` or equivalent) and ensure it succeeds.
2. Execute the type checker (`npm run type-check` or equivalent) with zero errors.
3. Run the full test suite and confirm all original tests pass and new folder tests pass.
4. Lint the codebase and fix any violations.
5. Manually test the UI flow:
   - Create a parent folder and a nested sub‑folder.
   - Add a document and a link inside the sub‑folder.
   - Open, edit, and delete each item.
   - Move the items to a different folder.
   - Perform a search while a folder is selected and verify results are limited to that folder.
6. Verify that generated documentation links include the correct folder path.
7. Ensure no existing functionality outside the folder system is broken.

# DONE WHEN
- [ ] Folder hierarchy model is added and migrations applied.
- [ ] Backend APIs for folder CRUD and item move are implemented.
- [ ] Front‑end displays a navigable folder tree with create/rename/delete capabilities.
- [ ] Documents and links can be opened, edited, deleted, and moved between folders.
- [ ] Search is correctly scoped to the selected folder.
- [ ] Documentation and link generation reflect the folder structure.
- [ ] All original and new tests pass, build succeeds, and linting is clean.
- [ ] Manual UI verification confirms the full workflow works without regressions.

tum ney naw to ab build nikalni ha naw he isey live kerna ha Just ye kam ker dena taky quickly ho zayada time ni lagey. no build no commit no push.

<!-- Task 3: --> 

https://linkedinpilot-ai.vercel.app/meeting-planner

# TASK
Implement a bidirectional linking feature between meeting notes/recordings and calendar events so that users can:
- From a meeting‑notes page, select one or multiple notes or recordings and link them to a specific calendar event via a button or UI control.
- From the calendar view, click an event and see a popup listing all linked notes/recordings, with direct navigation to each item.
The feature must integrate with the existing meeting‑notes, recording, and calendar modules without breaking current functionality.

# CONTEXT
Inspect the repository to locate the following areas before making changes:
- Front‑end components/pages that display meeting notes, recordings, and the calendar/scheduler UI.
- State‑management (e.g., Redux, Context, stores) that holds notes, recordings, and calendar event data.
- Backend API routes, controllers, or services that fetch/create/update notes, recordings, and calendar events.
- Database schema/models for notes/recordings and calendar events (look for foreign‑key relationships or join tables).
- Existing utility functions for linking entities, opening pop‑ups/modals, and navigation.
- Tests (unit/integration/e2e) that cover the above modules.
Follow the project's naming conventions, folder structure, and coding style throughout.

# STEPS
1. **Explore the codebase**: Identify the components/pages for meeting notes, recordings, and the calendar view. Locate the data models and API endpoints that handle these entities.
2. **Determine current linking capability**: Verify whether any existing association (e.g., a `meetingId` field on notes) already exists. Document findings.
3. **Design the linking data model**: If no suitable relation exists, plan a minimal join table or add a nullable `eventId` field to the notes/recordings model. Ensure migrations are created only if required.
4. **Create UI controls**:
   - Add a “Link to Event” button on the meeting‑notes page.
   - Implement a modal/popup that lists upcoming calendar events (fetch via existing API) with checkboxes for multi‑select.
   - On selection, call an API to associate the chosen notes/recordings with the selected event(s).
5. **Extend the calendar view**:
   - Add a clickable area or icon on each event that opens a popup showing all linked notes/recordings.
   - Each listed item should be a link that navigates directly to its detail page.
6. **Backend updates**:
   - Add/extend API endpoints to create and retrieve the note‑event links (e.g., `POST /events/:id/links`, `GET /events/:id/links`).
   - Update controllers/services to handle the new association, using existing validation and auth middleware.
7. **Database migration** (if needed): Write a migration that adds the foreign‑key column or join table, respecting existing data.
8. **Update types/interfaces**: Adjust TypeScript (or relevant) definitions for notes, recordings, and events to include the new relationship.
9. **Write/adjust tests**: Add unit tests for the new API routes, integration tests for the linking flow, and UI tests for the modal and calendar popup.
10. **Run the full test suite and linting**; fix any failures introduced by the changes.
11. **Manual verification**: Start the app, create a note, link it to an event, and confirm the link appears in the calendar popup and navigation works both ways.
12. **Document the feature**: Add a brief entry to the project’s feature list or README describing how to use the linking UI.

# CONSTRAINTS
- Do not modify unrelated pages, components, or APIs.
- Preserve all existing functionality; existing notes and events must continue to work without linking.
- Use only current dependencies; do not add new libraries unless a missing UI component (e.g., modal) cannot be built with the existing component library.
- Keep the data model change minimal and backward compatible (nullable fields or separate join table).
- Follow the project’s authentication/authorization flow for the new endpoints.
- Maintain the existing design system for buttons, modals, and popups; match styling and accessibility patterns.
- Do not rename existing files or break import paths.
- Ensure type safety; avoid `any` or type‑casting shortcuts.

# VALIDATE
1. Run the project's build command (e.g., `npm run build` or `yarn build`).
2. Execute the type checker (`npm run type-check` or equivalent) and ensure no new errors.
3. Run the full test suite (`npm test` or `yarn test`) and confirm all existing tests pass and new tests succeed.
4. Lint the codebase (`npm run lint`) and fix any warnings/errors.
5. Manually start the development server, create a meeting note, link it to a calendar event, and verify:
   - The link is saved in the database (inspect via API or DB client).
   - The calendar event shows a popup with the linked note.
   - Clicking the note in the popup navigates to its detail view.
   - Unlinked notes still appear normally.
6. Confirm that navigating to unrelated pages shows no regression.
7. If any step fails, debug, fix, and repeat validation until all checks pass.

# DONE WHEN
- [ ] UI button and modal for linking notes/recordings to calendar events are implemented.
- [ ] Calendar events display a popup with correctly linked notes/recordings and navigation works.
- [ ] Backend API endpoints for creating and retrieving links are functional and secured.
- [ ] Database schema includes the new relationship without breaking existing data.
- [ ] Types/interfaces are updated and type‑checked.
- [ ] All existing tests pass and new tests covering the linking flow pass.
- [ ] Linting and build succeed with no new warnings.
- [ ] Manual testing confirms bidirectional linking works as described.

tum ney naw to ab build nikalni ha naw he isey live kerna ha Just ye kam ker dena taky quickly ho zayada time ni lagey. no build no commit no push.

<!-- Tas -->
