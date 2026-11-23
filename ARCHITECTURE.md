# Architecture and scope note

**Goal:** a deliberately small, end-to-end writing workflow: create → edit → save → share → reopen.

**Stack:** FastAPI serves the user-designed static HTML/CSS/JS editor and provides JSON APIs; SQLite stores demo users, documents and collaborator access. Bleach sanitizes rich-text HTML before persistence. The supplied UI's original localStorage store was replaced with API requests to avoid a browser-only copy that fails to demonstrate backend persistence.

**Data model:**
- `users(id, name)`: three synthetic demo users.
- `documents(id, owner_id, title, content, updated_at)`.
- `shares(document_id, user_id, role)`: `view` or `edit` permission. Existing databases are migrated automatically to add `role` with `edit` default.

**Key decisions:**
1. Preserve the minimal, restrained typography and document list from the supplied UI, while reusing the working FastAPI backend.
2. Keep the demo switcher for reviewer convenience, explicitly without claiming secure authentication.
3. Enforce role restrictions on the server for requests, not only by hiding editor controls.
4. Autosave after a short idle period; provide an explicit Save button and visual status.
5. Import text and Markdown as editable text, convert DOCX in the browser with Mammoth, and limit embedded raster images.
6. Use SQLite for inspectable prototype persistence. An ephemeral hosted disk does not meet long-term durability requirements.

**Deliberate exclusions:** real authentication, revision history, real-time collaboration, merge/conflict handling, monitoring, and production hardening.

**Next if funded:** real auth and authorization, managed Postgres, revision history with conflict detection, then real-time collaboration based on observed demand.
