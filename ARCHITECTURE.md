# Tempo — architecture

How the app is put together, and why. `AGENTS.md` says *how to work*; `CONSTRAINTS.md` says *what is forbidden*. This file is the shape of the code.

## 1. Stack (as installed in this repo)

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16.3.8, App Router | `src/app`, route groups, server components by default |
| UI | React 19.2.8 | Server/client split per component |
| Language | TypeScript 5, `strict: true` | Alias `@/*` → `src/*` (see `tsconfig.json`) |
| Styling | Tailwind CSS 4 | `@tailwindcss/postcss`; tokens in `@theme inline` in `globals.css` |
| Database | Supabase Postgres | `supabase/schema.sql` is the source of truth |
| Auth | Supabase Auth, email + password only | no OAuth, no magic link |
| Security | Row Level Security | enabled on every table, owner-scoped policies |
| AI | One server-side LLM call for planning | provider isolated in `src/lib/planner/llm.ts` so it is swappable |
| Deploy | Vercel | env vars set in project settings |

Runtime dependencies are only `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`. There is no date library — time handling uses `Intl` and `Date`.

## 2. Folder structure

```
src/
  app/
    (auth)/login, (auth)/signup     public pages, redirect to (app) when signed in
    (app)/                          protected pages (session required)
      onboarding/                   sleep window, class time, daily limit, timezone
      dashboard/                    this week at a glance
      tasks/                        tasks CRUD
      commitments/                  recurring weekly blocks CRUD
      calendar/                     week view
      focus/                        pomodoro timer, strict + flexible
      settings/                     profile, pace factor, sign out
    api/plan/generate/route.ts      POST: build the week (server only, calls the LLM)
    api/plan/replan/route.ts        POST: replan remaining work (stretch)
  components/                       reusable UI. No database calls in here, ever.
  lib/
    supabase/
      client.ts                     browser client (singleton)
      server.ts                     server client + cookie session refresh
    data/                           ALL database access lives here
      profile.ts tasks.ts commitments.ts courses.ts sessions.ts focusLogs.ts
    planner/
      score.ts                      deterministic priority score
      slots.ts                      free-slot finder (sleep, commitments, limits)
      schedule.ts                   orchestrates plan generation
      llm.ts                        the only place that calls the LLM
      validate.ts                   validates LLM output, deterministic fallback
    focus/
      timer.ts                      timestamp-based timer
      pip.ts                        Document Picture-in-Picture + title fallback
    types.ts                        shared types mirroring the database
supabase/
  schema.sql                        source of truth for the database
```

Route groups keep `(auth)` and `(app)` URLs flat: `/login` lives in `(auth)/login`, `/tasks` in `(app)/tasks`. `(app)` is where the session check lives — a layout guard, not a check repeated in every page.

> Only `src/app/{layout,page}.tsx`, `globals.css`, and `favicon.ico` exist today — `src/lib/` does not exist yet. Everything above is the target layout. `src/lib/types.ts` is generated from `supabase/schema.sql` and is the first thing to write; until it exists, no schema change can satisfy the two-file rule in `CONSTRAINTS.md`.

## 3. Data flow

```
UI component / page
      ↓  calls a function
src/lib/data/*.ts        ← the only place that talks to Supabase
      ↓  supabase-js query, RLS applies
Postgres
```

- Pages and components never construct a Supabase client or call `.from()` themselves. They call `src/lib/data`.
- `src/lib/data` returns plain typed rows (from `src/lib/types.ts`). It does not return Supabase response objects.
- Reads happen in server components; writes go through server actions or route handlers. Either way the work lands in `src/lib/data`.
- RLS is the real authorization boundary: even a buggy query can only ever return the caller's own rows. Never work around it with the service role key.

## 4. Data model

`supabase/schema.sql` is the source of truth. File order: helper function → tables → triggers → indexes → RLS → grants. **The schema has been run in Supabase: all six tables exist and RLS is enabled on every one.** It is applied by hand in the SQL editor, so a future change is not live until the user runs it — say so explicitly when the schema changes.

### Tables

| Table | Columns beyond `created_at` | Notes |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `name`, `timezone`, `sleep_start`, `sleep_end`, `earliest_class_time`, `work_hours_per_day`, `pace_factor`, `onboarded`, `updated_at` | One row per user, created by trigger. Keyed by `id`, **not** `user_id`. |
| `courses` | `user_id`, `name`, `color` | `color` defaults to `#6366f1`. |
| `tasks` | `user_id`, `course_id?`, `title`, `type`, `deadline`, `grade_weight`, `difficulty`, `estimated_hours`, `priority_override?`, `is_group`, `status`, `notes`, `updated_at` | The unit of work the planner schedules. |
| `commitments` | `user_id`, `title`, `category`, `is_recurring`, `day_of_week?`, `specific_date?`, `start_time`, `end_time` | Fixed blocks, local wall-clock. |
| `sessions` | `user_id`, `task_id`, `planned_start`, `planned_end`, `status`, `ai_reason`, `plan_version` | Planner output. No `updated_at`. |
| `focus_logs` | `user_id`, `task_id?`, `session_id?`, `mode`, `started_at`, `ended_at`, `focused_minutes`, `distraction_count` | One row per finished focus session. No `updated_at`. |

### Constraints the app must respect

- `tasks.type` ∈ `assignment | project | exam | quiz | other`; `tasks.status` ∈ `todo | in_progress | done`.
- `commitments.category` ∈ `class | org | church | committee | other`; `is_recurring` decides whether `day_of_week` (0 = Sunday, matching `Date.getDay()`) or `specific_date` is required, and a CHECK enforces exactly one.
- `sessions.status` ∈ `planned | done | skipped | moved`. There is **no** `in_progress` session status — in-progress work is `tasks.status = 'in_progress'`.
- `focus_logs.mode` ∈ `strict | flexible`, defaulting to `strict`.
- Ranges: `difficulty` 1–5, `priority_override` 1–5, `grade_weight` 0–100, `estimated_hours` > 0, `work_hours_per_day` 1–16, `pace_factor` 0.5–3.0, `focused_minutes` ≥ 0.
- `end_time > start_time` on `commitments` means no commitment crosses midnight. The sleep window (`23:00` → `06:00`) does cross it, so `slots.ts` must handle the wrap.
- `updated_at` exists **only** on `profiles` and `tasks`, via the `set_updated_at()` trigger. Never read or write it elsewhere.
- `deadline`, `planned_start`, `planned_end`, `started_at`, `ended_at` are `timestamptz` — store and compare UTC. `start_time`, `end_time`, `sleep_start`, `sleep_end`, `earliest_class_time` are `time` (local wall-clock).
- `timezone` is `text`, not a Postgres tz type. Validate the onboarding value against `Intl.supportedValuesOf('timeZone')`.

### Deletion behaviour (intentional, keep it)

- `tasks → sessions` is `on delete cascade`: deleting a task deletes its sessions, including `moved` ones. The delete-task confirmation **must** say so — "this also removes N planned session(s) for this task" — before the delete goes through.
- `focus_logs.task_id` is `on delete set null`, and `focus_logs.session_id` likewise. Deleting a task never destroys the user's focus history.
- A `focus_logs` row with `task_id = null` came from untimed free focus. It has no estimate to compare against, so **the pace factor must ignore it** — filter `task_id is not null` before averaging.

### Auth, RLS, grants

- `on_auth_user_created` (`security definer`, `set search_path = ''`) inserts the profile on sign-up, reading `name` from `raw_user_meta_data`. Sign-up must pass `options.data.name` or the profile name is null. Keep the `security definer` + empty `search_path` pattern for any new trigger function.
- RLS is enabled on all six tables via a `do` loop; each has a `<table>_own` policy, `for all to authenticated`, using `(select auth.uid())` — on `id` for `profiles`, on `user_id` elsewhere.
- Grants cover `authenticated` only. Anon has no access at all, so the session check in the `(app)` layout is UX, not the security boundary.
- Onboarding is complete when `profiles.onboarded` is true, not when the row merely exists. Route on that flag.

### Indexes, and the queries they serve

`tasks (user_id, deadline)` → the planner's task queue · `tasks (user_id, status)` → board columns · `commitments (user_id)` → weekly expansion · `sessions (user_id, planned_start)` → the week view, always as a `planned_start` range · `sessions (task_id)` → a task's sessions, and the cascade delete · `focus_logs (user_id, started_at)` → the pace-factor average · `focus_logs (task_id)` → per-task focus history. No unique constraints beyond the primary keys.

## 5. Planner flow

Compute first, ask the LLM second. The LLM chooses *ordering and phrasing*, never *validity*.

1. **Score.** `src/lib/planner/score.ts` computes a deterministic priority per task: deadline urgency (days remaining) × grade weight × difficulty factor, or `priority_override` when the user set one (a `smallint` 1–5, so it is a rank, not a score to blend). A task with `status = 'in_progress'` is treated as already started and ranks ahead of untouched work. No randomness, no LLM.
2. **Estimate.** `effective_hours = estimated_hours × profiles.pace_factor`.
3. **Free slots.** `src/lib/planner/slots.ts` walks the week and carves out working hours minus the sleep window, minus commitments, minus every existing session that will survive the plan. It respects `earliest_class_time` (nothing late the night before an early class) and `work_hours_per_day`.
   - **Occupied time** = all commitments plus all sessions **except the future `planned` rows being replaced**. `done`, `skipped`, and `moved` sessions stay, so they block. A `moved` session is user-owned: never overwrite its times and never plan into them.
   - Sessions belonging to a task the user already started (`tasks.status = 'in_progress'`) are occupied too — elapsed work is still elapsed.
4. **Ask.** `src/lib/planner/llm.ts` sends the scored tasks and the free slots, and expects **only JSON**: `[{ "task_id", "start", "end", "reason" }]`. `reason` is the one-sentence "why here" shown next to the session. The LLM's `start` / `end` / `reason` are mapped on insert to the `planned_start` / `planned_end` / `ai_reason` columns — keep that translation in one place inside `schedule.ts`.
5. **Validate.** `src/lib/planner/validate.ts` rejects the output if a session overlaps a commitment or a surviving session, falls in the sleep window, breaks the daily hour limit, is not `planned_end > planned_start`, starts in the past for the current week, lands after the task's deadline, or references an unknown `task_id`.
6. **Fall back.** On any failure — invalid JSON, validation rejection, timeout, provider error — `schedule.ts` places sessions deterministically (highest score first, earliest valid slot). The user always gets a valid plan; the LLM only adds reasons.

Stretch: **replan** deletes only future `planned` sessions and inserts a new batch with `plan_version = max + 1`. `done`, `skipped`, and `moved` rows stay as history, which is exactly why step 3 treats them as occupied. **Pace factor** = average of (actual focused hours ÷ estimated hours) over `focus_logs` **where `task_id is not null`**, clamped to 0.5–3.0; the clamp mirrors the `pace_factor` CHECK, so an out-of-range write is rejected by Postgres — clamp before writing.

## 6. Focus flow

- **Timer** (`src/lib/focus/timer.ts`): store the start timestamp, compute remaining time from the clock. Never count `setInterval` ticks — background tabs throttle timers and the count would drift.
- **Strict mode**: Fullscreen API, and the Page Visibility API counts a tab switch as a distraction. Distraction counting is strict-mode only; write `distraction_count = 0` in flexible mode.
- **Flexible mode**: floating timer via the Document Picture-in-Picture API where available (Chromium desktop). Fallback: countdown in `document.title`.
- **Logging**: one `focus_logs` row when the session ends. `focused_minutes` is `numeric(6,1)` — write one decimal computed from elapsed milliseconds, never a rounded integer. `task_id` and `session_id` are both nullable, so untimed free focus is legal; set `session_id` when the focus came from a planned block, since that link is what attributes actual minutes to a task for the pace factor.
- **Early stops**: there is no flag column. An early stop is inferred from `ended_at` being shorter than the planned block and `focused_minutes` below it — derive it in the UI, do not invent a column.
- **Pace factor ignores `task_id is null` logs.** Free focus has no `estimated_hours` to compare against, so it must not move the average. Always filter before averaging, in one helper.
- A web app **cannot block device notifications**. The app does not claim to, and must not pretend a focus mode prevents a phone call.

## 7. Validation flow

| Where | What it checks |
| --- | --- |
| Client form | Required fields, enums as `<select>`, `difficulty` 1–5, `grade_weight` 0–100, `estimated_hours` > 0, `deadline` in the future, `end_time > start_time` on commitments. Fast feedback only. |
| Server action / route handler | The same rules, re-checked authoritatively before any write, mirroring the schema CHECKs. The client check is never trusted. |
| `planner/validate.ts` | LLM output: shape, known `task_id`, no overlaps, inside working hours, outside the sleep window (including the midnight wrap), daily limit respected, `planned_end > planned_start`, ends before the deadline. |
| `lib/types.ts` | Row shape at the boundary; anything unexpected is discarded rather than rendered. |

## 8. Error handling flow

- **Postgres error codes** are translated at the data-layer boundary: `23514` (check violation — an out-of-range `pace_factor`, `end_time <= start_time`, a missing `day_of_week`) → a field-level message; `23503` (foreign key) → "that course was deleted, pick another"; `42501` (RLS / privilege) → a session-expired redirect; `22P02` / `23502` (bad numeric or date text) → a validation error. Never show `error.message` raw.
- Every fetch returns a discriminated result or throws a typed error; components render the error state instead of crashing.
- Auth failures redirect to `(auth)/login` with a `next` return path. A missing profile or `onboarded = false` routes to `onboarding` instead of failing.
- LLM failure is **not** an error state: `validate.ts` failure or provider error falls through to deterministic placement, and the plan is shown with a quiet "planned automatically" note.
- `focus_logs` write failure never blocks the user; surface it as a non-blocking notice and keep the session result locally.
- Writes that can partially succeed are ordered so the recoverable half runs first, and the user is told what did not save.