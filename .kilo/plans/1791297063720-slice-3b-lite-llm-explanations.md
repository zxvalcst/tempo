# Slice 3b-lite: LLM Explanations for Planned Sessions

## Goal
Add an LLM layer that rewrites the `ai_reason` for each planned session and provides a weekly summary, without changing the deterministic scheduler's output.

## Scope
- New file: `src/lib/planner/llm.ts` (server-only)
- Modify: `src/app/(app)/actions.ts` → `generatePlanAction`
- Modify: `src/components/GeneratePlanButton.tsx` to show summary
- Modify: `src/app/(app)/(main)/dashboard/page.tsx` to show "Using standard explanations" note
- Update: `README.md` with `LLM_MODEL` env var docs

---

## Files to Create

### 1. `src/lib/planner/llm.ts` (NEW)
Server-only module that calls Groq's OpenAI-compatible chat completions endpoint.

**Function signature:**
```ts
export async function explainPlan(
  tasks: Task[],
  sessions: PlannedSession[],
  profile: Profile
): Promise<{ reasons: Array<{ index: number; reason: string }>; summary: string } | null>
```

**Requirements:**
- Read `LLM_API_KEY` and `LLM_MODEL` from `process.env` (server only, never `NEXT_PUBLIC_`)
- Use `fetch` with 8-second timeout (AbortController)
- POST to `https://api.groq.com/openai/v1/chat/completions`
- Request JSON mode: `response_format: { type: "json_object" }`
- System prompt: instruct model to return strict JSON with `reasons` array (index + one-sentence reason ≤140 chars) and `summary` (1-2 sentences)
- User prompt: include task list (title, deadline, grade weight, difficulty) and session list (index, task title, start, end)
- Validate response shape by hand; on any failure (timeout, rate limit, bad JSON, missing keys) return `null`
- Never log the API key

**Groq model:** Use `LLM_MODEL` from env (default `llama-3.3-70b-versatile` per `.env.local`)

---

## Files to Modify

### 2. `src/app/(app)/actions.ts` — `generatePlanAction`
**Changes:**
- Import `explainPlan` from `@/lib/planner/llm`
- After `validatePlan` passes and before `deleteFuturePlanned`/`insertPlannedBatch`:
  - Call `explainPlan(tasks, sessions, profile)`
  - If result is not null:
    - Map `reasons` by `index` to `sessions` array → add `reason` to each session
    - Store `summary` to return in action state
  - If result is null: keep deterministic `reason` from `buildWeek`
- Return `{ placed, version, summary, aiUnavailable: boolean }` in `PlanFormState`

### 3. `src/lib/validation.ts` — `PlanFormState`
**Add to type:**
```ts
export type PlanFormState = {
  message?: string;
  placed?: number;
  version?: number;
  error?: boolean;
  summary?: string;      // NEW: LLM weekly summary
  aiUnavailable?: boolean; // NEW: true when LLM failed
};
```

### 4. `src/components/GeneratePlanButton.tsx`
**Changes:**
- Show `state.summary` under the button when present (styled as a notice)
- Show "Using standard explanations" when `state.aiUnavailable` is true
- Keep existing placed/version message

### 5. `src/app/(app)/(main)/dashboard/page.tsx`
**Changes:**
- The dashboard already shows `session.ai_reason` in the Today list (line 117)
- No changes needed for session display — the `ai_reason` comes from the database
- Optional: show the latest plan's summary if available (but not required for this slice)

### 6. `README.md`
**Add environment variable documentation:**
```
LLM_API_KEY=...          # Server-only, Groq API key
LLM_MODEL=llama-3.3-70b-versatile  # Groq model name (configurable)
```

---

## Data Flow

```
generatePlanAction
    │
    ├─► buildWeek(profile, tasks, commitments, fixedSessions, completed)
    │       └─► returns { sessions: PlannedSession[], candidates }
    │
    ├─► validatePlan(sessions, context)  // gate
    │
    ├─► explainPlan(tasks, sessions, profile)  // NEW: LLM call
    │       ├─► success: attach reasons to sessions, capture summary
    │       └─► failure: keep deterministic reasons, aiUnavailable = true
    │
    ├─► deleteFuturePlanned(now)
    ├─► insertPlannedBatch(sessionsWithReasons, version)
    │
    └─► return { placed, version, summary, aiUnavailable }
```

---

## Validation & Error Handling

| Failure Point | Behavior |
|--------------|----------|
| `fetch` timeout (8s) | Return `null`, use deterministic reasons, `aiUnavailable = true` |
| Groq rate limit (429) | Return `null`, use deterministic reasons, `aiUnavailable = true` |
| Invalid JSON response | Return `null`, use deterministic reasons, `aiUnavailable = true` |
| Missing `reasons` or `summary` keys | Return `null`, use deterministic reasons, `aiUnavailable = true` |
| Reason > 140 chars | Truncate in validation (or reject and fallback) |
| Network error | Return `null`, use deterministic reasons, `aiUnavailable = true` |

**Key principle:** LLM failure is never a user-facing error. The plan always succeeds with deterministic reasons.

---

## Acceptance Criteria

1. `npx tsc --noEmit` passes
2. `npm run lint` passes
3. `npm run build` passes
4. Generate plan button shows weekly summary when LLM succeeds
5. Generate plan button shows "Using standard explanations" when LLM fails
6. Each session in the database has an `ai_reason` (from LLM or deterministic)
7. Dashboard Today list shows the `ai_reason` for each session
8. API key never exposed to client (verified by grep for `LLM_API_KEY` in client code)
9. `LLM_MODEL` documented in README.md

---

## Out of Scope

- Replan button (stretch)
- Pace factor learning (stretch)
- Overload warning (already exists, deterministic)
- Weekly review (stretch)
- Any changes to the scheduler logic
- Any schema changes
- Dark mode

---

## Dependencies

No new npm dependencies. Uses native `fetch` and `AbortController`.

---

## Implementation Order

1. Create `src/lib/planner/llm.ts`
2. Update `PlanFormState` in `src/lib/validation.ts`
3. Wire `explainPlan` into `generatePlanAction` in `src/app/(app)/actions.ts`
4. Update `GeneratePlanButton.tsx` to display summary and AI unavailable notice
5. Update `README.md` with env var docs
6. Run `npx tsc --noEmit && npm run lint && npm run build` to verify