# CLAUDE.md

## Project
A web app for university students that plans their week and helps them focus.
Working name: **Tempo** (placeholder, may change).

Pitch: *"A study planner that learns how long things actually take you."*

Core loop: the user enters tasks and fixed commitments -> an AI-assisted planner
builds a weekly schedule -> the user works in a focus timer that logs real focus
time -> the planner uses that data to correct future estimates and replan.

Hard deadline: submission on **Oct 6, 23:59**. Prefer a small, polished, working
feature set over a large unfinished one.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth (email + password only, no OAuth), Row Level Security
- Server-side LLM call (provider wrapped in `src/lib/planner/llm.ts` so it is swappable)
- Deployed on Vercel

## Commands
- `npm run dev`: dev server
- `npm run build`: production build (must pass before finishing a task)
- `npm run lint`: lint
- `npx tsc --noEmit`: type check

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `LLM_API_KEY` (server only, never prefixed with NEXT_PUBLIC)

Never commit `.env.local`. Never use the Supabase service role key in client code.

## Folder structure
```
src/
  app/
    (auth)/login, signup        public pages
    (app)/                      protected pages
      onboarding/
      dashboard/
      tasks/
      commitments/
      calendar/
      focus/
      settings/
    api/plan/generate/          POST: build a plan (server only)
    api/plan/replan/            POST: replan remaining work
  components/                   reusable UI, no database calls inside
  lib/
    supabase/                   browser client, server client, session refresh
    data/                       ALL database access lives here
      profile.ts tasks.ts commitments.ts courses.ts sessions.ts focusLogs.ts
    planner/
      score.ts                  priority score
      slots.ts                  free-slot finder
      schedule.ts               orchestrates plan generation
      llm.ts                    LLM call
      validate.ts               checks LLM output
    focus/
      timer.ts                  timestamp-based timer
      pip.ts                    Picture-in-Picture helper + fallbacks
    types.ts                    shared types matching the database
supabase/
  schema.sql                    source of truth for the database
```

## Data model (see `supabase/schema.sql`)
profiles, courses, tasks, commitments, sessions, focus_logs.
All tables except profiles have `user_id` (defaults to `auth.uid()`) and an RLS
policy limiting rows to their owner. Times are stored as UTC `timestamptz`;
commitment times are local wall-clock times in `profiles.timezone`
(default `Asia/Jakarta`). `day_of_week`: 0 = Sunday ... 6 = Saturday.

## Planner rules
1. **Compute first, ask the LLM second.** Priority score is deterministic:
   urgency (days to deadline) x grade weight x difficulty factor, or
   `priority_override` if set.
2. Effective hours for a task = `estimated_hours x profiles.pace_factor`.
3. Free slots = working hours minus sleep window, minus commitments, minus
   existing done/in-progress sessions. Respect `earliest_class_time` (no late
   slots the night before an early class) and `work_hours_per_day`.
4. The LLM receives the tasks (with scores) and free slots, and returns **only
   JSON**: `[{ task_id, start, end, reason }]`. `reason` is a one-sentence "why
   here" shown to the user.
5. `validate.ts` must reject output that: overlaps a commitment or another
   session, falls in the sleep window, exceeds the daily limit, lands after the
   task deadline, or references an unknown task. On failure, fall back to a
   deterministic placement so the user always gets a valid plan.
6. Replan: delete future sessions with status `planned`, insert a new batch with
   `plan_version = previous max + 1`. Keep done/skipped sessions as history.
7. Pace factor update: average of (actual focused hours / estimated hours) over
   completed tasks, clamped to 0.5-3.0.

## Focus mode rules
- Two modes: **strict** (fullscreen via the Fullscreen API, tab switches counted
  as distractions through the Page Visibility API) and **flexible** (timer
  floats in a small window, only time is logged, no distraction counting).
- Floating timer: use the Document Picture-in-Picture API when available
  (Chromium desktop). Fallback: show the countdown in `document.title`.
- Timer correctness: store the start timestamp and compute remaining time from
  the clock. Never rely on counting `setInterval` ticks (background tabs throttle).
- Write a `focus_logs` row when a session ends, including if the user stops early.
- A web app cannot block device notifications. Do not claim or attempt it.

## Constraints
- Do not add dependencies without a clear reason; mention it when you do.
- No database calls inside UI components. Go through `src/lib/data/`.
- Keep RLS enabled on every table. If you change the schema, update
  `supabase/schema.sql` and `src/lib/types.ts` together and tell me, since I run
  the SQL manually in Supabase.
- Validate all user input on the server as well as the client.
- Handle loading, empty, success, and error states for every screen that fetches data.
- Keep changes focused. No unrelated refactors.
- LLM calls happen only in server routes. The API key never reaches the browser.

## Workflow
- For anything bigger than a small fix, plan first and wait for my go-ahead.
- Build in thin vertical slices, each working end to end (UI -> data layer -> database).
- Before finishing a task: `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- Commit after each working slice with a clear message.
- Keep the UI clean and simple: this will be shown in a short demo.