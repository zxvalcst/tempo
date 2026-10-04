import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { secondaryButtonClassName } from "@/components/form";
import { TaskActions } from "@/components/TaskActions";
import { dueState, formatDeadline } from "@/lib/dates";
import { getProfile } from "@/lib/data/profile";
import { listTasks } from "@/lib/data/tasks";
import type { TaskType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Tasks · Tempo",
};

const typeChip: Record<TaskType, string> = {
  assignment: "bg-accent-sky",
  project: "bg-accent-lavender",
  exam: "bg-accent-pink",
  quiz: "bg-accent-sage",
  other: "bg-primary",
};

export default async function TasksPage() {
  const [profile, tasks] = await Promise.all([getProfile(), listTasks()]);

  if (!profile) redirect("/onboarding");

  const open = tasks.filter((task) => task.status !== "done");
  const finished = tasks.length - open.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Tasks</h1>
          <p className="mt-1 text-base text-muted">
            {tasks.length === 0
              ? "Everything you have to finish goes here."
              : `${open.length} open${finished > 0 ? `, ${finished} done` : ""}, soonest deadline first.`}
          </p>
        </div>

        <Link
          href="/tasks/new"
          className="rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
        >
          Add task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <section className="rounded-card border border-line bg-card p-7 text-center shadow-soft">
          <h2 className="text-base font-semibold text-ink">No tasks yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-strong">
            Add your assignments, projects, and exams. The planner reads these to build your week.
          </p>
          <Link
            href="/tasks/new"
            className="mt-5 inline-block rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105"
          >
            Add your first task
          </Link>
        </section>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-soft">
          {tasks.map((task) => {
            // Computed here on the server so every row agrees with this render.
            const due = dueState(task.deadline, task.status);
            const dueChip =
              due === "overdue" ? "bg-danger" : due === "soon" ? "bg-primary" : null;
            const dueLabel = due === "overdue" ? "Overdue" : due === "soon" ? "Due soon" : null;

            return (
              <li
                key={task.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className={`text-base font-semibold ${
                        task.status === "done"
                          ? "text-muted-strong line-through"
                          : "text-ink"
                      }`}
                    >
                      {task.title}
                    </h2>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-xs font-medium text-ink ${typeChip[task.type]}`}
                    >
                      {task.type.replace("_", " ")}
                    </span>
                    {dueChip ? (
                      <span
                        className={`rounded-pill px-2 py-0.5 text-xs font-medium text-ink ${dueChip}`}
                      >
                        {dueLabel}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-strong">
                    {task.course_name ?? "No course"} · {formatDeadline(task.deadline, profile.timezone)}
                  </p>

                  <p className="text-xs text-muted-strong">
                    {Number(task.estimated_hours)}h · difficulty {task.difficulty}/5 ·{" "}
                    {Number(task.grade_weight)}% of grade
                    {task.is_group ? " · group project" : ""} ·{" "}
                    {task.status === "done" ? "done" : task.status.replace("_", " ")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/tasks/${task.id}`} className={secondaryButtonClassName()}>
                    Edit
                  </Link>
                  <TaskActions
                    taskId={task.id}
                    title={task.title}
                    isDone={task.status === "done"}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}