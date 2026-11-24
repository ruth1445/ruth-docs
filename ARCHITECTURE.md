# Architecture and scope note

**Goal:** a deliberately small, end-to-end writing workflow: create → edit → save → share → reopen.

**Stack:** FastAPI serves the user-designed static HTML/CSS/JS editor and provides JSON APIs; SQLite stores demo users, documents and collaborator access. Bleach sanitizes rich-text HTML before persistence. The supplied UI's original localStorage store was replaced with API requests to avoid a browser-only copy that fails to demonstrate backend persistence.

**Data model:**
- `users(id, name)`: three synthetic demo users.
- `documents(id, owner_id, title, content, updated_at)`.
- `shares(document_id, user_id, role)`: `view` or `edit` permission. Existing databases are migrated automatically to add `role` with `edit` default.
- `document_versions(id, document_id, title, content, saved_by, created_at)`: up to 15 manual checkpoints per document, with permission-checked restore and a recovery snapshot of the outgoing draft.

**Key decisions:**
1. Preserve the minimal, restrained typography and document list from the supplied UI, while reusing the working FastAPI backend.
2. Show a simple Continue as Ruth/Leen/Arden chooser for reviewer convenience, explicitly without claiming secure authentication.
3. Enforce role restrictions on the server for requests, not only by hiding editor controls.
4. Autosave after a short idle period; provide an explicit Save button and visual status.
5. Start new accounts with a blank editor and disappearing placeholders, plus a live body word count. Import only .txt and .md through Upload, and insert size-limited raster images through + image.
6. Use SQLite for inspectable prototype persistence. An ephemeral hosted disk does not meet long-term durability requirements.

**Deliberate exclusions:** real authentication, automatic per-edit revision tracking, real-time collaboration, merge/conflict handling, monitoring, and production hardening.

**Next if funded:** real auth and authorization, managed Postgres, an automated revision log with conflict detection, then real-time collaboration based on observed demand.
