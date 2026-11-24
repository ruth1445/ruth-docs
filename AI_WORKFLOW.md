# AI Workflow

Ruth Docs is a document editor with features inspired by Substack, Notion, and Google Docs. I used Codex for the backend and Claude Design for the frontend. The backend runs on Python and FastAPI, with SQLite as the database. It stores user information, access permissions, and the documents themselves. One caveat is that the app is deployed on Render's free tier, so the data might not survive a redeployment.

I spent the first 15 minutes reading through the assessment, then another 15 minutes figuring out which tasks to delegate to AI. While those were being carried out, I was planning what features to add and what to leave out. I deliberately skipped a real login system and kept the architecture light, mostly because of the time constraints.

I changed quite a few of the AI suggestions along the way, especially the design. I wanted to keep it minimalistic, and it took several iterations to get to the final version.

For testing, I manually went through the features and also ran pytest.

There are still limitations: no page breaks, no option to download documents in different formats, and no real login or authentication system.
