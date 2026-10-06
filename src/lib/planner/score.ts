import type { Task } from "@/lib/types";

const DAY_MS = 86_400_000;

export type ScoredTask = {
  id: string;
  title: string;
  status: Task["status"];
  deadline: string;
  grade_weight: number;
  /** Higher sorts earlier. */
  score: number;
  /** Effective minutes still to do, after pace factor and completed work. */
  remainingMinutes: number;
  priority_override: number | null;
};

/**
 * Deadline urgency: 1.0 today, decaying towards 0 far out.
 *
 * The `1 +` is deliberate. A plain `1 / daysRemaining` divides by zero for a
 * task due today, and clamps an overdue task to 0 — exactly backwards. An
 * overdue deadline lands on 1.0, the most urgent value there is.
 */
export function urgency(deadline: string, now: Date = new Date()): number {
  const remaining = new Date(deadline).getTime() - now.getTime();
  const days = Number.isNaN(remaining) ? 0 : Math.max(0, Math.ceil(remaining / DAY_MS));

  return 1 / (1 + days);
}

/**
 * urgency × grade weight × difficulty.
 *
 * Both factors are offset by 0.5 so they compress into a useful band rather
 * than starting at zero: a task worth 0% of the grade would otherwise score
 * exactly 0 and be starved out of every plan forever.
 */
export function scoreTask(task: Task, now: Date = new Date()): number {
  return (
    urgency(task.deadline, now) *
    (0.5 + Number(task.grade_weight) / 100) *
    (0.5 + Number(task.difficulty) / 10)
  );
}

/**
 * Effective hours: the estimate scaled by the learned pace factor, minus work
 * already completed. `completedMinutes` comes from `done` sessions for now;
 * Slice 7 refines it with `focus_logs`.
 */
export function effectiveHours(
  task: Task,
  paceFactor: number,
  completedMinutes: number,
): number {
  const estimate = Number(task.estimated_hours) * paceFactor;

  return Math.max(0, estimate - completedMinutes / 60);
}

/**
 * Ranks by override first, then by score. `priority_override` is a `smallint`
 * rank, not a blendable score, so it is never folded into the arithmetic — it
 * simply wins when present, and a larger number wins.
 *
 * Nothing in the UI writes `priority_override` today, so in practice this only
 * ever falls through to the score comparison.
 */
export function compareByPriority(a: ScoredTask, b: ScoredTask): number {
  if (a.priority_override !== null && b.priority_override !== null) {
    return b.priority_override - a.priority_override;
  }
  if (a.priority_override !== null) return -1;
  if (b.priority_override !== null) return 1;

  if (b.score !== a.score) return b.score - a.score;

  const byDeadline = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  if (byDeadline !== 0) return byDeadline;

  return a.id.localeCompare(b.id);
}

/** Scores and ranks every supplied task. Callers filter for the window. */
export function scoreTasks(
  tasks: Task[],
  paceFactor: number,
  completedMinutes: Record<string, number>,
  now: Date = new Date(),
): ScoredTask[] {
  return tasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      deadline: task.deadline,
      grade_weight: Number(task.grade_weight),
      score: scoreTask(task, now),
      remainingMinutes: effectiveHours(task, paceFactor, completedMinutes[task.id] ?? 0) * 60,
      priority_override: task.priority_override,
    }))
    .sort(compareByPriority);
}
