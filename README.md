Ruth Docs is a document editor built for an assessment. 

## Run locally

With Python 3.11+.

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

- **The demo login is NOT authentication**.
- SQLite persists locally, but a Render free deployment usually has an **ephemeral filesystem**. A redeploy/restart may clear the database unless you configure persistent storage. For durable hosting use an appropriate managed database or attached disk.

## Deployment

The included `render.yaml` provides a demo web service on Render. Connect the repository in Render to deploy.
