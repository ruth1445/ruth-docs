# Ruth Docs Submission

This submission contains Ruth Docs, a document editor built for the assessment. It was designed around a fairly simple writing experience, with features inspired by Substack, Notion, and Google Docs.

## Files included

- Source code: `app.py` for the FastAPI backend, the `static/` folder for the frontend, and the supporting project files including `requirements.txt` and `render.yaml`.
- `tests/`: automated tests for the backend and main document workflows.
- `README.md`: instructions for setting up and running the project locally.
- `ARCHITECTURE.md`: an explanation of the architecture and the decisions I made.
- `AI_WORKFLOW.md`: how I used AI, what I worked on, and the limitations.
- `SUBMISSION.md`: this overview of what is being submitted.
- `WALKTHROUGH.txt`: the link to the recorded walkthrough, included separately in the Google Drive submission folder.

## Links

Source code: https://github.com/ruth1445/ruth-docs

Live product: https://ruth-docs.onrender.com

Walkthrough video: provided in `WALKTHROUGH.txt` in the Google Drive folder.

## What works and what is missing

The editor supports creating and formatting documents, saving and autosaving, importing text and Markdown, inserting and adjusting images, mock user switching, sharing with view or edit permissions, word count, and lightweight version history.

I did not add real authentication, page breaks, downloads in different formats, or real-time collaboration. Also, the SQLite data on the deployed free Render service may not persist after a restart or redeployment.
