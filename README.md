# Ruth Docs

A small document editor with the user's minimalist, typographic UI and a FastAPI + SQLite backend. Built as an **assessment prototype**, not production software.

## Features

- New demo accounts open a blank writing page: gray `Your Title Here` and `start typing..` placeholders disappear when you type. The untouched sample document is removed, but user-created work is preserved.
- Minimal **demo account chooser** with three synthetic personas and a visible "signed in as" indicator. This is not real authentication.
- Live **word count**, excluding the document title and image markup.
- **Version history**: optional named checkpoints via "save version", last 15 snapshots, and one-click restore that first preserves the current draft. Autosave remains separate from checkpoints.

- Create, open, rename, format, and save documents (including an autosave after editing pauses).
- Bold, italic, underline, headings (H1/H2/H3), bulleted and numbered lists.
- Import only `.txt` and `.md` from the Upload picker. Insert images separately via [+ image]; click an image for sizing, alignment, centered crop presets (1:1 or 4:3), and move controls.
- Browse documents owned by or shared with a simulated user; share with `view` or `edit` access, change roles and revoke access.
- SQLite stores documents and sharing rules; refreshing the page reopens the last selected document in the same browser tab.
- Server-side access and permission checks, HTML sanitization, basic automated tests.

## Run locally

Requires Python 3.11+.

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt pytest httpx
python3 -m uvicorn app:app --reload
```

Visit <http://127.0.0.1:8000>. Demo accounts: **Ruth**, **Leen**, and **Arden**. Run tests with `python3 -m pytest -q`.

You can override the SQLite path with `RUTH_DOCS_DB=/path/to/database.db`.

## Demo flow

1. As Ruth, create a document, change its title, and format the contents.
2. Click Save or stop typing briefly to autosave. Refresh the page and verify the content and open document are retained.
3. Use **share** to grant Leen `can view` access. Switch to Leen and verify the document is read-only.
4. Switch to Ruth, change Leen to `can edit`, then switch back to Leen and verify that editing works.
5. Import a `.txt` or `.md` file from Upload; add a picture through [+ image], click it to resize, crop, align, or move it.
6. Switch to Arden and verify that documents not shared with him do not appear or open.

### Version history walkthrough

Click **[history] → save version** to record a checkpoint; edit the document, create another, and click **restore** on an older checkpoint to revert. Restoring automatically makes a recovery checkpoint for the previously current draft.

## Important limitations

- **The demo login is NOT authentication**. Any visitor can pretend to be a demo user by changing the supplied user ID. Do not enter sensitive or personal data.
- Simulated sharing is only a demonstration of role-based permissions, not secure production identity management.
- Rich-text editing uses browser `execCommand`, a legacy API; consider a modern editor library for production.
- Image support embeds size-limited data URLs in SQLite and is not an asset pipeline. Image crops use centered presets, not a freeform cropping interface. Some image formats may not be decodable by every browser.
- No concurrent editing, conflict resolution, multi-device revision sync, audit logs, or production security audit. Version history is capped at 15 snapshots per document.
- SQLite persists locally, but a Render free deployment usually has an **ephemeral filesystem**. A redeploy/restart may clear the database unless you configure persistent storage. For durable hosting use an appropriate managed database or attached disk.

## Deployment

The included `render.yaml` provides a demo web service on Render. Connect the repository in Render to deploy. If using an ephemeral filesystem, **do not claim durable persistence across deploys**.

## Submission

See `ARCHITECTURE.md`, `AI_WORKFLOW.md`, `SUBMISSION.md`, and `VIDEO_SCRIPT.md`. Personalize all descriptions of AI usage and testing to what was actually done.