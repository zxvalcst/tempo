# Tempo — hard constraints

Rules that are not negotiable without explicit approval. If a task seems to require breaking one of these, stop and ask first.

## Stack

1. **Do not change the technology stack** unless it is strictly necessary for a feature to work. Next.js App Router + TypeScript + Tailwind + Supabase + one server-side LLM call + Vercel is the stack. No new frameworks, state libraries, form libraries, or CSS systems.
2. **Do not add a dependency without a clear reason, and say so when you do.** Name the package, what it replaces, and why hand-rolling it is worse. Current runtime deps: `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`. There is no date library — that means `Intl` / `Date`, not a silent `npm i date-fns`.

## Data

3. **No database calls inside UI components.** No Supabase client, no `.from()`, no `.rpc()` in anything under `src/app` or `src/components`. All access goes through `src/lib/data/`.
4. **Keep RLS enabled on every table.** No exceptions, no `service_role` in request paths to dodge a policy.
5. **Schema changes touch two files at once:** `supabase/schema.sql` **and** `src/lib/types.ts`. Then tell the user, because they run the SQL manually in Supabase — nothing applies automatically. Say exactly which statements to run.

## Secrets and AI

6. **LLM calls only in server routes** (`src/app/api/**`) or server actions. Never from a client component.
7. **The API key and the Supabase service role key never reach the browser.** `LLM_API_KEY` must not be `NEXT_PUBLIC_`-prefixed. `.env.local` is gitignored — never commit it, never paste its contents into code, docs, errors, or commit messages.

## Scope

8. **No unrelated refactors.** Do not rename, reformat, reorganize, or "tidy" code outside the task at hand. Unrelated files in a diff are a bug, not a bonus.
9. **Do not change public API routes without explicit approval.** Request and response shapes of `/api/plan/*` are a contract. Additive fields are fine; breaking changes are not.
10. **Preserve existing architecture conventions.** Route groups `(auth)` / `(app)`, the `src/lib/{supabase,data,planner,focus}` split, the `@/*` alias, and the `(auth)` / `(app)` layout guards stay as they are. `ARCHITECTURE.md` describes the intended shape — deviate only with approval.

## Delivery

11. **A slice is not done until `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.** Report failures honestly; never loosen types, disable lint rules, or add `any` to get a green build.
12. **Small and working beats large and unfinished.** Deadline is Oct 6, 23:59. Stretch features (replan, pace factor, overload warning, weekly review) start only when priorities 1–7 are done and stable.