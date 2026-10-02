# Equipment storage

Dark, role-aware inventory and request app for shared equipment.

Members browse the shared catalog, build a request, and track what they have checked out. Administrators manage supplies, approvals, returns, groups, and access codes. Every stock and request change goes through server actions.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows, copy `.env.example` to `.env.local` and set `SESSION_SECRET`. The first page load seeds demo groups, supplies, one pending request, and one overdue checkout. Access codes are printed once in the server log and written to `data/initial-codes.txt`. That file and `data/store.json` stay on this machine.

The first load also writes `data/reset-code.txt` and marks it read-only. That file is not in the repo. Entering its reset code on the login screen restores the original access codes. The app never rewrites the file.

## Layout

- `app/` and `components/` — pages and interface
- `src/domain/` — types and rules for stock, requests, overdue, permissions, and name suggestions
- `src/data/` — repository interface, local JSON store, and an unused Supabase adapter

Set `DATA_PROVIDER=supabase` plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when a schema exists. The Supabase file implements the same interface and does not invent tables.
