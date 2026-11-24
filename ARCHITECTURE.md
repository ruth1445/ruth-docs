# Architecture

I kept the architecture relatively light because of the assessment's time constraints. Ruth Docs uses a JavaScript, HTML, and CSS frontend, a Python backend with FastAPI, and SQLite for storage. The idea was to get the entire writing workflow working without spending too much time setting up infrastructure.

The frontend sends requests to FastAPI to create, retrieve, update, and share documents. SQLite stores the user accounts, document titles and content, sharing permissions, and saved versions. The main tables are `users`, `documents`, `shares`, and `document_versions`.

For sharing, a document can be opened with view or edit access. The backend checks these permissions instead of relying only on what the interface allows someone to click. Since the accounts are simulated, though, this is not real authentication.

I kept autosave along with a manual save button, and added a simple version history with saved checkpoints and a restore option. For uploads, text and Markdown files are handled separately from inserted images. The backend also sanitizes document HTML before storing it.

I chose SQLite because it was simple to use for a small prototype. One limitation is that the live version is running on Render's free tier, so the database might be lost when the service restarts or redeploys.

I left out actual login, page breaks, downloads in different formats, and real-time collaboration. With more time, I'd first add authentication and a persistent database, then improve the document editor and collaboration features.
