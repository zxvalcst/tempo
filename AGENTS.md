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

## Theme — use tokens, never hardcoded colors

Every color lives in `src/app/globals.css`. **Light mode only, by design:** there is no dark theme, and no `dark:` variants. If a dark theme is ever wanted, it is its own slice with its own token block — do not sprinkle `dark:` variants in.

Use the Tailwind token utilities. Never write `text-zinc-900`, `bg-black/5`, `text-[#4A3426]`, or any other literal color in a component. To change the look, edit `globals.css` only.

| Token | Classes | Use for |
| --- | --- | --- |
| background `#FFF8EC` | `bg-background` | page surface |
| card `#FFFDF8` | `bg-card` | cards, input fills |
| border `#F0E2C8` | `border-line`, `divide-line` | card edges, dividers, header |
| border-strong `#A8825A` | `border-line-strong` | **inputs and form controls only** |
| text `#4A3426` | `text-ink` | all body text, headings, button labels |
| muted `#8A7565` | `text-muted` | secondary text at **16px or larger only** |
| muted-strong `#7A6555` | `text-muted-strong` | every text under 16px: hints, labels, errors |
| primary `#FFC773` | `bg-primary` | buttons, active nav pill (always with `text-ink`) |
| accents | `bg-accent-pink`, `-sage`, `-sky`, `-lavender` | reserved for course colors, calendar and session blocks |
| danger `#E58B8B` | `bg-danger` | error banner background **only**, never a text color |

Also tokens, not literals: `rounded-card` (20px), `rounded-pill`, `shadow-soft`.

Two constraints the measured contrast ratios force:

- **`text-muted` is 4.1:1 on the background, which fails WCAG AA below 16px.** Anything smaller uses `text-muted-strong` (~5.2:1). That covers form hints, field labels, and error text.
- **`border-line` is 1.3:1 and nearly invisible.** It is for decorative edges only. Inputs and form controls use `border-line-strong` (~3.4:1) plus a focus ring in `text-ink`, so the edges survive a projector or a dim laptop screen.
- **`text-danger` is banned.** `danger` as text on cream drops to roughly 2:1. Pair it as `bg-danger` with `text-ink`.

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
- **Replan deletes only future `planned` sessions.** `done`, `skipped`, and `moved` rows stay.
- **Fixed time never moves**: commitments, `moved` sessions, `done` sessions, and any session with a focus timer currently running. `moved` means the user placed it — never overwrite those times. `skipped` is terminal history and does not block.
- **`tasks.status = 'in_progress'` does not occupy time** by itself; a task blocks hours only through its own sessions. Ranking comes solely from the priority score — status never re-orders it.
- **Deleting a task cascades to its sessions.** The confirmation dialog must say how many planned sessions will be removed before the delete happens.
- **The pace factor ignores `focus_logs` rows with a null `task_id`** — untimed free focus has no estimate to compare against.
- **Store `focused_minutes` with one decimal** (`numeric(6,1)`), computed from elapsed milliseconds. Never a rounded integer.

## Current state of this repo

- `next dev` rewrites the `nextjs-agent-rules` block at the top of this file. Keep it byte-for-byte.
- Auth and onboarding are built: `(auth)` sign up / log in, `src/proxy.ts` session refresh, the `(app)` auth guard, the `(main)` onboarded guard, and the profile upsert. `/settings` is the only editor of an existing profile.
- **The pastel theme is light mode only.** No `dark:` variants, no `prefers-color-scheme` block. Colors live in `globals.css` and nowhere else.
- Tasks, commitments, planner, calendar, and focus are not started.
- **`src/proxy.ts`, not `middleware.ts`.** Next.js 16 renamed it. Supabase's published guide still says `middleware.ts`, and a file with that name is silently ignored — route protection would appear to work in dev and never fire in production.
- **`time` columns come back as `"HH:MM:SS"`.** Pass every one through `toHhMm()` from `src/lib/types.ts` before it reaches an `<input type="time">`.
- `supabase/schema.sql` holds the real schema and has been applied in Supabase. It is still run by hand, so every change must be handed back as runnable SQL and mirrored into `src/lib/types.ts`.
- `app/layout.tsx` metadata is still the `Create Next App` default; update it when the first real screen lands.