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
  proxy.ts                           session refresh + signed-out redirect (Next 16;
                                     this file was middleware.ts before Next 16)
  app/
    (auth)/login, (auth)/signup       public pages, redirect to / when signed in
      actions.ts                      "use server": signUp, signIn
    (app)/                            protected: session required, nothing else
      layout.tsx                      auth guard only, app shell, header + nav
      loading.tsx, error.tsx          the group's loading and error states
      actions.ts                      "use server": saveOnboardingAction,
                                      saveSettingsAction, signOut
      onboarding/                     first-run setup; redirects to /settings once onboarded
      (main)/                         onboarded guard sits here, not in (app)
        layout.tsx                    no profile or !onboarded -> /onboarding
        dashboard/                    this week at a glance
        settings/                      the only place to edit the profile
        tasks/                        tasks CRUD
        commitments/                  recurring weekly blocks CRUD
        calendar/                     week view
        focus/                        pomodoro timer, strict + flexible
    api/plan/generate/route.ts        POST: build the week (server only, calls the LLM)
    api/plan/replan/route.ts          POST: replan remaining work (stretch)
  components/                         reusable UI. No database calls in here, ever.
    form.tsx                          FormCard, Field, SubmitButton, inputClassName,
                                      secondaryButtonClassName
    ScheduleForm.tsx                  one form, two modes: onboarding and settings
    TaskForm.tsx                      one form, two modes: create and edit a task
    CommitmentForm.tsx                one form, two modes: create and edit a commitment
    TaskActions.tsx                   "use client", per-row mark-done and delete
    CommitmentRow.tsx                 one commitment row, shared by the day and date groups
    AppNav.tsx                        "use client", usePathname active link
    LoginForm, SignupForm, SignOutButton, AuthFooter
  lib/
    supabase/
      server.ts                       server client + getCurrentUser()
      client.ts                       browser client (singleton) — not yet needed
    data/                             ALL database access lives here
      profile.ts tasks.ts commitments.ts courses.ts sessions.ts focusLogs.ts
    validation.ts                     hand-rolled validators mirroring the CHECKs
    dates.ts                          date and time formatting: toHhMm, due-soon state,
                                      the `datetime-local` value for an instant, and the
                                      weekday/date of "today" in the user's own zone
    timezones.ts                      time zone select options
    planner/
      score.ts                        deterministic priority score
      slots.ts                        free-slot finder (sleep, commitments, limits)
      schedule.ts                     orchestrates plan generation
      llm.ts                          the only place that calls the LLM
      validate.ts                     validates LLM output, deterministic fallback
    focus/
      timer.ts                        timestamp-based timer
      pip.ts                          Document Picture-in-Picture + title fallback
    types.ts                          shared types mirroring the database
supabase/
  schema.sql                          source of truth for the database
```

Route groups keep `(auth)` and `(app)` URLs flat: `/login` lives in `(auth)/login`, `/dashboard` in `(app)/(main)/dashboard`. Two guards, deliberately separated:

| Guard | File | Job |
| --- | --- | --- |
| Session refresh + bounce | `src/proxy.ts` | Runs before render on matched paths; refreshes the cookie, sends signed-out users to `/login`. |
| Auth | `src/app/(app)/layout.tsx` | Authoritative session check for everything under `(app)`. |
| Onboarded | `src/app/(app)/(main)/layout.tsx` | Sends users without a completed profile to `/onboarding`. |

`/onboarding` is a **sibling** of `(main)`, not a child, so the guard that redirects to it is never inherited by it. That is what makes a redirect loop structurally impossible — do not "helpfully" move that check up into `(app)`.

`/settings` is the **only** editor of an existing profile. It sits inside `(main)`, and `/onboarding` redirects to it once `onboarded` is true, so two URLs can never both edit the same five fields. That redirect lives in the onboarding page and nowhere else; if a loop appears, it has been copied somewhere it does not belong.

Both pages render the same `ScheduleForm`, which takes its server action as a prop: `saveOnboardingAction` redirects to `/`, `saveSettingsAction` returns `{ saved: true }` and stays put so the confirmation is visible. One form, no duplicated fields. `saveOnboarding` is an upsert on `id` with no `onboarded` filter, and writes `name` only when the caller supplies it, so an onboarding save can never clear an existing name.

> `src/proxy.ts` is Next.js 16's replacement for `middleware.ts`. Supabase's own Next.js guide still says `middleware.ts`; that file name is silently ignored by this version. Every protected path must appear in its `matcher`, or the session-refresh guard silently skips it.

## 3. Theme

All color lives in `src/app/globals.css`: raw values in `:root`, mapped into Tailwind in `@theme inline`. **Components never contain a color literal** — no `text-zinc-900`, no `bg-black/5`, no `text-[#4A3426]`. Change the look by editing that one file.

**Light mode only, by design.** There is no `prefers-color-scheme` block and no `dark:` variant anywhere in `src/`. Adding a dark theme is its own slice with its own token block, not a sprinkle of `dark:` classes.

| CSS variable | Tailwind token | Value | Use for |
| --- | --- | --- | --- |
| `--background` | `bg-background` | `#FFF8EC` | page surface |
| `--card` | `bg-card` | `#FFFDF8` | cards, input fills |
| `--border` | `border-line`, `divide-line` | `#F0E2C8` | decorative edges, dividers, header |
| `--border-strong` | `border-line-strong` | `#A8825A` | **inputs and form controls only** |
| `--text` | `text-ink` | `#4A3426` | all body text, headings, button labels |
| `--muted` | `text-muted` | `#8A7565` | secondary text, **16px or larger only** |
| `--muted-strong` | `text-muted-strong` | `#7A6555` | every text under 16px |
| `--primary` | `bg-primary` | `#FFC773` | buttons, active nav pill, always with `text-ink` |
| `--accent-pink` | `bg-accent-pink` | `#F6B8C8` | reserved for course colors and calendar blocks |
| `--accent-sage` | `bg-accent-sage` | `#BFD8B0` | reserved; also the success notice |
| `--accent-sky` | `bg-accent-sky` | `#B9D7EA` | reserved for course colors and calendar blocks |
| `--accent-lavender` | `bg-accent-lavender` | `#D5C8F0` | reserved for course colors and calendar blocks |
| `--danger` | `bg-danger` | `#E58B8B` | error notice background only |

Shape tokens, same rule: `--radius-card` → `rounded-card` (20px), `--radius-pill` → `rounded-pill`, `--shadow-soft` → `shadow-soft`. Type is Quicksand via `next/font/google` (`--font-quicksand`), with `Geist_Mono` kept for `--font-mono`.

The four accents are **deliberately unused so far** — they are the palette for course colors, calendar blocks, and session chips. Do not delete them as dead code.

### Why two borders and two muted tones

Contrast ratios measured against the card surface:

| Pair | Ratio | Consequence |
| --- | --- | --- |
| ink on background | ~11:1 | body text is fine |
| primary + ink | ~7.6:1 | button label is fine |
| sage / sky / lavender / pink + ink | ~7.0–7.7:1 | accent surfaces are fine |
| danger + ink | ~4.6:1 | error notice is fine |
| muted-strong on card | ~5.4:1 | small text passes AA |
| **muted on card** | **~4.3:1** | **fails AA below 16px — use `text-muted-strong`** |
| **line on card** | **~1.3:1** | **invisible as an input border** |
| line-strong on card | ~3.4:1 | input boundaries pass the 3:1 UI minimum |

So: soft `--border` everywhere decorative, tan `--border-strong` only where the user must see an edge, and `--muted-strong` for every string under 16px. `text-danger` is banned outright — danger as text on cream is roughly 2:1. Pair it as `bg-danger` with `text-ink`.

## 4. Data flow
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

## 5. Data model

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
- **PostgREST returns `time` columns as `"HH:MM:SS"`.** An `<input type="time">` only accepts `"HH:MM"`, so run every `time` value through `toHhMm()` from `src/lib/dates.ts` before binding it to a form control. Forgetting it yields a silently blank input, not an error.
- The sleep window **may cross midnight**; only `sleep_start = sleep_end` is rejected. This is the opposite of the `commitments` rule above — do not apply one to the other.
- `timezone` is `text`, not a Postgres tz type. Validate the onboarding value against `Intl.supportedValuesOf('timeZone')`.

### Deletion behaviour (intentional, keep it)

- `tasks → sessions` is `on delete cascade`: deleting a task deletes its sessions, including `moved` ones. The delete-task confirmation **must** say so before the delete goes through, using the static sentence "This also removes any scheduled study blocks for this task." Do not count the sessions to fill in a number — the warning is static by design, so no query is needed.
- `focus_logs.task_id` is `on delete set null`, and `focus_logs.session_id` likewise. Deleting a task never destroys the user's focus history.
- A `focus_logs` row with `task_id = null` came from untimed free focus. It has no estimate to compare against, so **the pace factor must ignore it** — filter `task_id is not null` before averaging.

### Auth, RLS, grants

- `on_auth_user_created` (`security definer`, `set search_path = ''`) inserts the profile on sign-up, reading `name` from `raw_user_meta_data`. Sign-up must pass `options.data.name` or the profile name is null. Keep the `security definer` + empty `search_path` pattern for any new trigger function.
- RLS is enabled on all six tables via a `do` loop; each has a `<table>_own` policy, `for all to authenticated`, using `(select auth.uid())` — on `id` for `profiles`, on `user_id` elsewhere.
- Grants cover `authenticated` only. Anon has no access at all, so the session check in the `(app)` layout is UX, not the security boundary.
- Onboarding is complete when `profiles.onboarded` is true, not when the row merely exists. Route on that flag.

### Indexes, and the queries they serve

`tasks (user_id, deadline)` → the planner's task queue · `tasks (user_id, status)` → board columns · `commitments (user_id)` → weekly expansion · `sessions (user_id, planned_start)` → the week view, always as a `planned_start` range · `sessions (task_id)` → a task's sessions, and the cascade delete · `focus_logs (user_id, started_at)` → the pace-factor average · `focus_logs (task_id)` → per-task focus history. No unique constraints beyond the primary keys.

## 6. Planner flow

Compute first, ask the LLM second. The LLM chooses *ordering and phrasing*, never *validity*.

1. **Score.** `src/lib/planner/score.ts` computes a deterministic priority per task: deadline urgency (days remaining) × grade weight × difficulty factor, or `priority_override` when the user set one (a `smallint` 1–5, so it is a rank, not a score to blend). Ranking comes from this score and nothing else — task status, type, and course never re-order it. No randomness, no LLM.
2. **Estimate.** `effective_hours = estimated_hours × profiles.pace_factor`.
3. **Free slots.** `src/lib/planner/slots.ts` walks the week and carves out working hours minus the sleep window, minus fixed time, minus the future `planned` sessions being replaced. It respects `earliest_class_time` (nothing late the night before an early class) and `work_hours_per_day`.
   - **Fixed time never moves**, and is exactly: all **commitments** · **`moved` sessions** (the user placed these — never overwrite the times) · **`done` sessions** (already-happened history) · **any session with a focus timer currently running**.
   - `skipped` is terminal history like `done`: not re-planned, not blocking.
   - Future `planned` sessions are the only rows a replan replaces. Everything else in the week is fixed.
   - `tasks.status = 'in_progress'` does **not** by itself occupy time. A task being worked on blocks its hours only through its own sessions.
   - A running focus timer has no `focus_logs` row yet (`ended_at` is `NOT NULL`), so the in-flight focus must reach the planner explicitly — the focus flow reports its `session_id` and `started_at` when it starts, and `schedule.ts` treats that window as fixed.
4. **Ask.** `src/lib/planner/llm.ts` sends the scored tasks and the free slots, and expects **only JSON**: `[{ "task_id", "start", "end", "reason" }]`. `reason` is the one-sentence "why here" shown next to the session. The LLM's `start` / `end` / `reason` are mapped on insert to the `planned_start` / `planned_end` / `ai_reason` columns — keep that translation in one place inside `schedule.ts`.
5. **Validate.** `src/lib/planner/validate.ts` rejects the output if a session overlaps fixed time or another planned session, falls in the sleep window, breaks the daily hour limit, is not `planned_end > planned_start`, starts in the past for the current week, lands after the task's deadline, or references an unknown `task_id`.
6. **Fall back.** On any failure — invalid JSON, validation rejection, timeout, provider error — `schedule.ts` places sessions deterministically (highest score first, earliest valid slot). The user always gets a valid plan; the LLM only adds reasons.

Stretch: **replan** deletes only future `planned` sessions and inserts a new batch with `plan_version = max + 1`; `done`, `skipped`, and `moved` rows stay, which is why step 3 counts them as fixed. **Pace factor** = average of (actual focused hours ÷ estimated hours) over `focus_logs` **where `task_id is not null`**, clamped to 0.5–3.0; the clamp mirrors the `pace_factor` CHECK, so an out-of-range write is rejected by Postgres — clamp before writing.

## 7. Focus flow

- **Timer** (`src/lib/focus/timer.ts`): store the start timestamp, compute remaining time from the clock. Never count `setInterval` ticks — background tabs throttle timers and the count would drift.
- **Strict mode**: Fullscreen API, and the Page Visibility API counts a tab switch as a distraction. Distraction counting is strict-mode only; write `distraction_count = 0` in flexible mode.
- **Flexible mode**: floating timer via the Document Picture-in-Picture API where available (Chromium desktop). Fallback: countdown in `document.title`.
- **Logging**: one `focus_logs` row when the session ends. `focused_minutes` is `numeric(6,1)` — write one decimal computed from elapsed milliseconds, never a rounded integer. `task_id` and `session_id` are both nullable, so untimed free focus is legal; set `session_id` when the focus came from a planned block, since that link is what attributes actual minutes to a task for the pace factor.
- **Early stops**: there is no flag column. An early stop is inferred from `ended_at` being shorter than the planned block and `focused_minutes` below it — derive it in the UI, do not invent a column.
- **Pace factor ignores `task_id is null` logs.** Free focus has no `estimated_hours` to compare against, so it must not move the average. Always filter before averaging, in one helper.
- A web app **cannot block device notifications**. The app does not claim to, and must not pretend a focus mode prevents a phone call.

## 8. Validation flow

| Where | What it checks |
| --- | --- |
| Client form | Required fields, enums as `<select>`, `difficulty` 1–5, `grade_weight` 0–100, `estimated_hours` > 0, `deadline` in the future, `end_time > start_time` on commitments. Fast feedback only. |
| Server action / route handler | The same rules, re-checked authoritatively before any write, mirroring the schema CHECKs. The client check is never trusted. |
| `planner/validate.ts` | LLM output: shape, known `task_id`, no overlaps, inside working hours, outside the sleep window (including the midnight wrap), daily limit respected, `planned_end > planned_start`, ends before the deadline. |
| `lib/types.ts` | Row shape at the boundary; anything unexpected is discarded rather than rendered. |

## 9. Error handling flow

- **Postgres error codes** are translated at the data-layer boundary: `23514` (check violation — an out-of-range `pace_factor`, `end_time <= start_time`, a missing `day_of_week`) → a field-level message; `23503` (foreign key) → "that course was deleted, pick another"; `42501` (RLS / privilege) → a session-expired redirect; `22P02` / `23502` (bad numeric or date text) → a validation error. Never show `error.message` raw.
- Every fetch returns a discriminated result or throws a typed error; components render the error state instead of crashing.
- Auth failures redirect to `(auth)/login` with a `next` return path. A missing profile or `onboarded = false` routes to `onboarding` instead of failing.
- LLM failure is **not** an error state: `validate.ts` failure or provider error falls through to deterministic placement, and the plan is shown with a quiet "planned automatically" note.
- `focus_logs` write failure never blocks the user; surface it as a non-blocking notice and keep the session result locally.
- Writes that can partially succeed are ordered so the recoverable half runs first, and the user is told what did not save.