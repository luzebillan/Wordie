# 02 — Database Setup & Schema

**What to build:** A local SQLite database in the main process using `better-sqlite3`. A unified `Cards` schema supporting all types (Useful Expressions, Glossary, Daily Words, Ready Versions) with SRS tracking fields (`Repetitions`, `Interval`, `EaseFactor`) and `UseCount`. IPC handlers to create, read, update, and delete cards.

**Blocked by:** 01-project-scaffold

**Status:** done

- [x] Install better-sqlite3 and configure it in the main process to save to `userData`.
- [x] Create the schema initialization script.
- [x] Implement IPC handlers for CRUD operations.
- [x] Write a simple frontend component to test creating and fetching a dummy card.
