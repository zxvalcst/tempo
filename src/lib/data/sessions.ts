import { createClient } from "@/lib/supabase/server";
import type { PlannedSession, Session, SessionWithTask } from "@/lib/types";

/**
 * Resolves the task title for each session. Tasks are fetched separately and
 * joined here, mirroring `withCourseNames` in tasks.ts, so the returned shape
 * does not depend on PostgREST foreign-key inference.
 */
async function withTaskTitles(sessions: Session[]): Promise<SessionWithTask[]> {
  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title")
    .returns<Array<{ id: string; title: string }>>();

  if (error) {
    throw new Error("Could not load your tasks.");
  }

  const titles = new Map((tasks ?? []).map((task) => [task.id, task.title]));

  return sessions.map((session) => ({
    ...session,
    task_title: titles.get(session.task_id) ?? "Untitled task",
  }));
}

/**
 * Sessions starting within `[from, to)`. This is the range query the
 * `sessions (user_id, planned_start)` index exists to serve, and the shape the
 * week view and the dashboard both want.
 */
export async function listSessionsInRange(
  from: string,
  to: string,
): Promise<SessionWithTask[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gte("planned_start", from)
    .lt("planned_start", to)
    .order("planned_start", { ascending: true })
    .returns<Session[]>();

  if (error) {
    throw new Error("Could not load your plan.");
  }

  return withTaskTitles(data ?? []);
}

/**
 * Sessions the planner must treat as immovable: `moved` because the user placed
 * them, `done` because they already happened.
 *
 * `skipped` is deliberately absent — it is terminal history that neither blocks
 * time nor gets re-planned. A session with a focus timer running would belong
 * here too, but no focus flow exists yet to report one.
 */
export async function listFixedSessions(): Promise<Session[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .in("status", ["moved", "done"])
    .returns<Session[]>();

  if (error) {
    throw new Error("Could not load your fixed sessions.");
  }

  return data ?? [];
}

/** The highest plan_version in use, or 0 when there are no sessions at all. */
export async function maxPlanVersion(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("plan_version")
    .order("plan_version", { ascending: false })
    .limit(1)
    .returns<Array<{ plan_version: number }>>();

  if (error) {
    throw new Error("Could not read your plan version.");
  }

  return Number(data?.[0]?.plan_version ?? 0);
}

/**
 * Deletes only *future* `planned` rows. `done`, `skipped` and `moved` are kept,
 * and so is a `planned` row that has already started — it is history now, not
 * something the planner is still proposing.
 */
export async function deleteFuturePlanned(now: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("status", "planned")
    .gt("planned_start", now);

  if (error) {
    throw new Error("Could not clear the previous plan.");
  }
}

export async function insertPlannedBatch(
  rows: PlannedSession[],
  version: number,
): Promise<void> {
  if (rows.length === 0) return;

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("You must be signed in to build a plan.");
  }

  const { error } = await supabase.from("sessions").insert(
    rows.map((row) => ({
      user_id: userData.user.id,
      task_id: row.task_id,
      planned_start: row.start,
      planned_end: row.end,
      status: "planned" as const,
      ai_reason: row.reason,
      plan_version: version,
    })),
  );

  if (error) {
    throw new Error("Could not save your plan.");
  }
}

/**
 * Minutes already completed per task, from `done` sessions only.
 *
 * This is what "hours already completed" subtracts from a task's estimate.
 * `focus_logs` would be the more accurate source once the focus timer exists —
 * see AGENTS.md: logs with a null `task_id` are ignored for the pace factor.
 */
export async function completedMinutesByTask(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("task_id, planned_start, planned_end")
    .eq("status", "done")
    .returns<Array<{ task_id: string; planned_start: string; planned_end: string }>>();

  if (error) {
    throw new Error("Could not load your completed sessions.");
  }

  const totals: Record<string, number> = {};

  for (const row of data ?? []) {
    const minutes =
      (new Date(row.planned_end).getTime() - new Date(row.planned_start).getTime()) / 60_000;

    if (!Number.isFinite(minutes) || minutes <= 0) continue;

    totals[row.task_id] = (totals[row.task_id] ?? 0) + minutes;
  }

  return totals;
}
