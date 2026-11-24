# Ruth Docs

Ruth Docs is a document editor I built for the assessment, with features inspired by Substack, Notion, and Google Docs. I kept the interface minimal and focused on the main writing workflow, including editing, saving, sharing, and reopening documents.

The backend is built with Python and FastAPI, and SQLite stores the users, documents, access permissions, and version checkpoints. The frontend uses HTML, CSS, and JavaScript.

## Running it locally

You will need Python 3.11 or later.

Clone the repository and open the project folder. Then run:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt pytest httpx
python3 -m uvicorn app:app --reload
```

Open http://127.0.0.1:8000 in your browser.

To run the automated tests:

```bash
python3 -m pytest -q
```

By default, SQLite stores the database in a local file. Its path can also be set using the `RUTH_DOCS_DB` environment variable.

## Features

Documents can be created, edited, formatted, and saved. There is an autosave option along with a manual save button. The editor also includes word count, basic version history, and a way to restore earlier saved versions.

There are three mock accounts: Ruth, Leen, and Arden. Documents can be shared with viewing or editing access. I added this account switcher to make it easier to demonstrate the sharing features without building a full login system.

The upload option accepts .txt and .md files. Images are inserted separately and can be resized, aligned, moved, or cropped using simple presets.

## Deployment and limitations

The live version is available at https://ruth-docs.onrender.com.

This is a prototype rather than a production application. The mock accounts are not real authentication, and there are no page breaks or options to export documents in multiple formats. There is also no real-time collaborative editing.

The app is deployed on Render's free tier. Since its filesystem is temporary, the SQLite data may not survive a restart or redeployment.
