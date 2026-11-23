"""Ruth Docs: deliberately scoped document-editor assessment prototype.

Demo account switching is NOT authentication. Never deploy with real user data.
"""
from __future__ import annotations

import html
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, Literal
import re

import bleach
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
MAX_UPLOAD = 1024 * 1024
MAX_HTML = 800_000
ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "div", "span", "img", "code", "figure"]


class CreateDocument(BaseModel):
    user_id: int
    title: str = Field(default="Untitled document", max_length=120)


class UpdateDocument(BaseModel):
    user_id: int
    title: Optional[str] = Field(default=None, max_length=120)
    content: Optional[str] = Field(default=None, max_length=MAX_HTML)


class ShareDocument(BaseModel):
    user_id: int
    target_user_id: int
    role: Literal["edit", "view"] = "edit"


def sanitize_rich_text(value: str) -> str:
    # Images may be embedded only as bounded PNG/JPEG/WebP data URLs. Reject SVG,
    # external tracking pixels, event handlers and executable markup.
    def attr_filter(tag: str, name: str, content: str) -> bool:
        if tag == "figure" and name == "data-align":
            return content in {"left", "center", "right"}
        if tag == "img" and name == "width":
            return content.isdigit() and 80 <= int(content) <= 1200
        if tag == "img" and name == "alt":
            return True
        if tag == "img" and name == "src":
            return (len(content) <= 450_000 and bool(re.fullmatch(
                r"data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+", content)))
        return False
    return bleach.clean(value, tags=ALLOWED_TAGS,
                        attributes=attr_filter, protocols=["data"], strip=True)


def validate_title(raw: str) -> str:
    title = raw.strip()
    if not title:
        raise HTTPException(422, "Document title cannot be empty")
    return title


def create_app(db_path: str | None = None) -> FastAPI:
    database = str(db_path or os.environ.get("RUTH_DOCS_DB", BASE / "ruth_docs.db"))
    Path(database).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect():
        conn = sqlite3.connect(database, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS documents(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id INTEGER NOT NULL REFERENCES users(id),
          title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE IF NOT EXISTS shares(
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          role TEXT NOT NULL DEFAULT 'edit',
          PRIMARY KEY (document_id,user_id));
        """)
        if "role" not in [r[1] for r in db.execute("PRAGMA table_info(shares)")]:
            db.execute("ALTER TABLE shares ADD COLUMN role TEXT NOT NULL DEFAULT 'edit'")
        for uid, name in [(1, "Ruth"), (2, "Leen"), (3, "Arden")]:
            db.execute("INSERT INTO users(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name", (uid, name))
        count = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        if count == 0:
            db.execute("INSERT INTO documents(owner_id,title,content) VALUES (?,?,?)", (
                1, "Field Notes", "<h2>Field Notes</h2><p>An observation is not yet an explanation.</p>"
                "<p>Begin with what you know. Mark what you assume. Return to what remains uncertain.</p>"))

    app = FastAPI(title="Ruth Docs", version="0.1-demo")
    app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")

    def require_user(db, user_id: int):
        if not db.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "Demo user not found")

    def get_accessible(db, doc_id: int, user_id: int):
        require_user(db, user_id)
        doc = db.execute("""SELECT d.*, u.name AS owner_name,
                EXISTS(SELECT 1 FROM shares s WHERE s.document_id=d.id AND s.user_id=?) AS is_shared
                FROM documents d JOIN users u ON u.id=d.owner_id
                WHERE d.id=? AND (d.owner_id=? OR EXISTS(
                SELECT 1 FROM shares s WHERE s.document_id=d.id AND s.user_id=?))""",
            (user_id, doc_id, user_id, user_id)).fetchone()
        if doc is None:
            raise HTTPException(404, "Document not found or not shared with this user")
        return doc

    @app.get("/")
    def index():
        return FileResponse(BASE / "static" / "index.html")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/users")
    def users():
        with connect() as db:
            return [dict(r) for r in db.execute("SELECT id, name FROM users ORDER BY id")]

    @app.get("/api/documents")
    def list_documents(user_id: int):
        with connect() as db:
            require_user(db, user_id)
            rows = db.execute("""SELECT d.id, d.title, d.owner_id, u.name AS owner_name,
                d.updated_at, (d.owner_id=?) AS is_owner,
                CASE WHEN d.owner_id=? THEN 'owner' ELSE
                  (SELECT s.role FROM shares s WHERE s.document_id=d.id AND s.user_id=?) END AS role
                FROM documents d JOIN users u ON u.id=d.owner_id
                WHERE d.owner_id=? OR EXISTS(
                SELECT 1 FROM shares s WHERE s.document_id=d.id AND s.user_id=?)
                ORDER BY d.updated_at DESC, d.id DESC""", (user_id, user_id, user_id, user_id, user_id)).fetchall()
            return [dict(r) for r in rows]

    @app.post("/api/documents", status_code=201)
    def create_document(payload: CreateDocument):
        title = validate_title(payload.title)
        with connect() as db:
            require_user(db, payload.user_id)
            cursor = db.execute("INSERT INTO documents(owner_id,title) VALUES (?,?)", (payload.user_id, title))
            return {"id": cursor.lastrowid, "title": title}

    @app.get("/api/documents/{doc_id}")
    def get_document(doc_id: int, user_id: int):
        with connect() as db:
            doc = get_accessible(db, doc_id, user_id)
            row = dict(doc)
            row["is_owner"] = doc["owner_id"] == user_id
            row["access"] = [dict(r) for r in db.execute(
                "SELECT user_id, role FROM shares WHERE document_id=? ORDER BY user_id", (doc_id,))]
            row["shared_with"] = [a["user_id"] for a in row["access"]]
            row["role"] = ("owner" if row["is_owner"] else next(
                (a["role"] for a in row["access"] if a["user_id"] == user_id), None))
            return row

    @app.patch("/api/documents/{doc_id}")
    def update_document(doc_id: int, payload: UpdateDocument):
        with connect() as db:
            doc = get_accessible(db, doc_id, payload.user_id)
            if doc["owner_id"] != payload.user_id:
                share = db.execute("SELECT role FROM shares WHERE document_id=? AND user_id=?",
                                   (doc_id, payload.user_id)).fetchone()
                if share is None or share["role"] != "edit":
                    raise HTTPException(403, "View-only users cannot edit documents")
            updates, values = [], []
            if payload.title is not None:
                updates.append("title=?")
                values.append(validate_title(payload.title))
            if payload.content is not None:
                updates.append("content=?")
                values.append(sanitize_rich_text(payload.content))
            if not updates:
                raise HTTPException(422, "Nothing to update")
            updates.append("updated_at=datetime('now')")
            values.append(doc_id)
            db.execute(f"UPDATE documents SET {', '.join(updates)} WHERE id=?", values)
            return {"saved": True}

    @app.post("/api/documents/{doc_id}/share", status_code=201)
    def share_document(doc_id: int, payload: ShareDocument):
        with connect() as db:
            doc = get_accessible(db, doc_id, payload.user_id)
            if doc["owner_id"] != payload.user_id:
                raise HTTPException(403, "Only the document owner can share")
            require_user(db, payload.target_user_id)
            if doc["owner_id"] == payload.target_user_id:
                raise HTTPException(422, "Owner already has access")
            db.execute("""INSERT INTO shares(document_id,user_id,role) VALUES (?,?,?)
                ON CONFLICT(document_id,user_id) DO UPDATE SET role=excluded.role""",
                       (doc_id, payload.target_user_id, payload.role))
            return {"shared": True, "target_user_id": payload.target_user_id, "role": payload.role}

    @app.delete("/api/documents/{doc_id}/share/{target_user_id}")
    def revoke_document(doc_id: int, target_user_id: int, user_id: int):
        with connect() as db:
            doc = get_accessible(db, doc_id, user_id)
            if doc["owner_id"] != user_id:
                raise HTTPException(403, "Only the document owner can revoke access")
            db.execute("DELETE FROM shares WHERE document_id=? AND user_id=?",
                       (doc_id, target_user_id))
            return {"revoked": True}

    @app.post("/api/import", status_code=201)
    async def import_document(user_id: int = Form(...), file: UploadFile = File(...)):
        filename = (file.filename or "").strip()
        suffix = Path(filename).suffix.lower()
        if suffix not in {".txt", ".md"}:
            raise HTTPException(415, "Import supports only .txt and .md files")
        raw = await file.read(MAX_UPLOAD + 1)
        if len(raw) > MAX_UPLOAD:
            raise HTTPException(413, "File exceeds 1 MB limit")
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(422, "Import a UTF-8 text file")
        title = (Path(filename).stem or "Imported notes")[:120]
        escaped = html.escape(text)
        paragraphs = escaped.replace("\r\n", "\n").replace("\r", "\n").split("\n\n")
        content = "".join("<p>" + p.replace("\n", "<br>") + "</p>" for p in paragraphs)
        with connect() as db:
            require_user(db, user_id)
            cursor = db.execute("INSERT INTO documents(owner_id,title,content) VALUES (?,?,?)",
                                (user_id, title, content))
            return {"id": cursor.lastrowid, "title": title}

    return app


app = create_app()
