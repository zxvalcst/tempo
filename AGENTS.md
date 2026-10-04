<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tempo — agent instructions

A weekly planner for university students. Pitch: *"A study planner that learns how long things actually take you."*

Core loop: tasks + fixed commitments → AI builds a weekly schedule → the user works in a focus timer that logs real focus minutes → those logs correct future time estimates.

**Hard deadline: Oct 6, 23:59.** Ship a small, polished, working feature set. Never start a stretch item while a higher-priority item is unfinished or broken.

## Feature priority — do not reorder

1. **Auth** — email sign up, log in, log out.
2. **Onboarding** — sleep window, earliest class time, max daily work hours, timezone (default `Asia/Jakarta`).
3. **Tasks CRUD** — title, course, type, deadline, grade weight %, difficulty 1–5, estimated hours, status.
4. **Commitments CRUD** — recurring weekly fixed blocks (classes, org meetings, church, committee work).
5. **AI weekly planner** — work sessions placed around commitments, each with a one-sentence reason.
6. **Calendar week view** — commitments and planned sessions.
7. **Focus mode (pomodoro)** — strict (fullscreen, tab switches counted as distractions) and flexible (small floating timer, time only). Logs actual focused minutes.
8. **Stretch, only if time remains** — replan button, pace factor learned from focus logs, overload warning, weekly review.

## How to work

1. **Inspect before changing code.** Read the files you are about to touch and the neighbours that already solve something similar. `src/` is still close to the create-next-app starter, so confirm what actually exists instead of assuming.
2. **Reuse what is there.** Extend existing components, helpers, and patterns before writing new ones. Two similar buttons or forms means one shared component.
3. **Work in thin vertical slices.** Each slice runs end to end: UI → data layer (`src/lib/data`) → database. A slice that only has UI is not done.
4. **Avoid unnecessary dependencies.** The runtime deps are `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js` — that is all. There is no date library; format and compare times with `Intl` / `Date`, or ask before adding one.
5. **Keep naming and folder structure consistent.** Follow the layout in `ARCHITECTURE.md`: `camelCase` files, PascalCase components, one concern per file.
6. **Validate on the client and the server.** Client checks are for fast feedback only; the server is authoritative and must re-validate before any write, mirroring the CHECK constraints in `supabase/schema.sql` so users get field errors instead of a 400.
7. **Handle every state.** Each screen that fetches data must handle loading, empty, success, and error. No blank screen, no unhandled throw.
8. **Verify before finishing.** `npx tsc --noEmit`, `npm run lint`, and `npm run build` must all pass. A slice that does not build is not finished.
9. **No unrelated changes.** Do not refactor, rename, or "clean up" code outside the task. Do not reformat files you did not otherwise touch.

## Stack already installed

Next.js 16.3.8 (App Router) · React 19.2.8 · TypeScript 5 (`strict: true`, alias `@/*` → `src/*`) · Tailwind CSS 4 (`@import "tailwindcss"` in `src/app/globals.css`, tokens in `@theme inline`) · Supabase (`@supabase/ssr` + `@supabase/supabase-js`) · deployed on Vercel. Details in `ARCHITECTURE.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | dev server |
| `npx tsc --noEmit` | type check |
| `npm run lint` | ESLint 9 flat config |
| `npm run build` | production build |

## Environment

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `LLM_API_KEY` (server only, never `NEXT_PUBLIC_`). `.env*` is already gitignored — never commit it, never paste its values into code, docs, or commits.

## Hard rules

See `CONSTRAINTS.md`. The ones that bite most often: RLS stays on for every table · schema changes land in `supabase/schema.sql` **and** `src/lib/types.ts` together, then get reported to the user because they run the SQL by hand in Supabase · no database calls inside components · LLM calls only in server routes.

## Database rules that are easy to get wrong

- The schema **has been run**: all six tables exist and RLS is enabled. Treat the live database as real — do not write code that assumes a table is missing.
- **Replan deletes only future `planned` sessions.** `done`, `skipped`, and `moved` stay as history.
- **`moved` means the user moved it.** Never overwrite those times, and treat them as occupied when planning — same for sessions of a task already `in_progress`.
- **Deleting a task cascades to its sessions.** The confirmation dialog must say how many planned sessions will be removed before the delete happens.
- **The pace factor ignores `focus_logs` rows with a null `task_id`** — untimed free focus has no estimate to compare against.
- **Store `focused_minutes` with one decimal** (`numeric(6,1)`), computed from elapsed milliseconds. Never a rounded integer.

## Current state of this repo

- `next dev` rewrites the `nextjs-agent-rules` block at the top of this file. Keep it byte-for-byte.
- `src/` contains only the starter `app/layout.tsx`, `app/page.tsx`, `app/globals.css`. The structure in `ARCHITECTURE.md` is the target, not what exists — `src/lib/` has no files yet.
- `supabase/schema.sql` holds the real schema and has been applied in Supabase. It is still run by hand, so every change must be handed back as runnable SQL and mirrored into `src/lib/types.ts`.
- `app/layout.tsx` metadata is still the `Create Next App` default; update it when the first real screen lands.