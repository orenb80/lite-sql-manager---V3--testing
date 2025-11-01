## Quick context (what this repo is)

- A single-process Express app (entry: `server.js`) that serves a static frontend under `public/` and exposes a REST API under `/api/*` to manage SQL Server instances (connect, list DBs/tables, CRUD, backups, restore).
- Frontend is a vanilla JS app located in `public/js/` (notably `app.js`, `query.js`, `crud.js`, `backup.js`, etc.) which calls the server APIs directly with fetch.
- Connections are session-scoped: `server.js` keeps a Map of connection pools per Express session (see `connectionPools` in `server.js`).

## Where to start (run & build)

- Development: `npm start` (runs `node server.js`). You can also pass a port: `node server.js 4000` or set `PORT` env var.
- Packaged executable: `npm run build-exe` uses `pkg` and bundles `public/**/*` — `package.json` contains the script.
- There is a Windows batch launcher in the repo root (`Run-SQL-Manager.bat`) used by maintainers; prefer `npm start` for iterative development.

## High-level architecture & patterns an agent should know

- Server responsibilities (see `server.js`):
  - Serve static frontend and a REST API.
  - Maintain connection pools per user session (keyed by `req.session.connectionId`).
  - For operations targeting a specific database, the code often clones the base config and creates a new `ConnectionPool` for that DB (so switching DBs creates short-lived pools).
  - Heavy operations (search, backup, restore) adjust timeouts and use SQL hints (e.g., `WITH (NOLOCK)`, `OPTION (MAXDOP 4, RECOMPILE)`); mimic these patterns when adding new queries to preserve performance characteristics.

- Frontend patterns (see `public/js/app.js` and related files):
  - Global functions and simple DOM manipulation; fetch-based API calls expect JSON responses with `{ success, ... }` or `{ error }` fields.
  - Search UI sends `criteria`, `searchMode` (`exact|startsWith|contains`), and server expects typed parameters — follow the existing searchModes when adding features.

## Important conventions & gotchas

- Authentication modes: server supports both SQL auth and NTLM Windows auth (see `useWindowsAuth` handling in `server.js`). When adding or changing auth flows, preserve existing request shapes used by the frontend (fields like `useWindowsAuth`, `windowsUsername`, `windowsPassword`).
- Security: `POST /api/custom-query` only accepts queries starting with `SELECT` (server-side check). Keep this safety check if you add query execution endpoints.
- Connection lifecycle: always respect the pattern of creating/closing pools. Long-running endpoints (backup/restore) increase request timeout (`request.timeout`) — new endpoints that may run long should follow the same approach.
- Error responses: endpoints usually return HTTP 400/500 with JSON `{ error: '...' }`; the frontend shows `data.error`. Use the same structure.

## Key files to reference when coding

- `server.js` — single source of truth for API behavior, session handling, connection management, and SQL patterns.
- `package.json` — start/build commands (`start`, `build-exe`).
- `public/js/app.js` — central frontend logic and examples of how the UI calls APIs and consumes responses.
- `public/js/{crud,query,backup,joins,aggregations,schema}.js` — examples for CRUD, custom queries, backups, joins and aggregation UIs.
- `documentation/` — high-level project docs and design notes; useful for feature intent and historical decisions.

## How to modify or add API endpoints (practical checklist)

1. Read `server.js` to see session / pool setup and follow the pattern: validate inputs → get `connectionPools.get(req.session.connectionId)` → create/clone `ConnectionPool` when switching DBs → `request.input(...)` for params → close short-lived pools.
2. Preserve parameter typing and use `sql` types (`sql.Int`, `sql.NVarChar`, `sql.DateTime`, `sql.Bit`) where appropriate, as the frontend relies on typed behavior.
3. For queries affecting performance, copy the existing search hints (NOLOCK, MAXDOP, RECOMPILE) and set reasonable timeouts (see where `request.timeout` is increased for backups/restores/search).
4. Return JSON shaped like existing endpoints (success vs error) so the UI can display messages without changes.

## Testing & debugging notes

- Fast local test: `npm start` then open `http://localhost:3000` (or your chosen port). The server logs informative `[INFO]`/`[ERROR]` messages that mirror API flow.
- If port is in use, `server.js` logs a suggestion: `Try: node server.js ${PORT + 1}`.
- When packaging with `pkg`, static assets under `public/` are included via `pkg.assets` in `package.json`. If you change frontend files, run `npm run build-exe` to test the packaged binary behavior.

## Small examples (copyable patterns)

- Check connection in middleware (pattern used throughout):
  const requireConnection = (req, res, next) => { if (req.session.connectionId && connectionPools.has(req.session.connectionId)) next(); else res.status(401).json({ error: 'Not connected to database' }); };

- Enforce SELECT-only for custom queries:
  if (!trimmedQuery.startsWith('SELECT')) return res.status(400).json({ error: 'Only SELECT queries are allowed for safety' });

---
If you want, I can iterate on wording or include quick links to specific lines (e.g., exact line ranges for connection handling or search query construction). Any missing areas you want me to expand? 