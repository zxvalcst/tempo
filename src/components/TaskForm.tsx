"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormCard, SubmitButton, inputClassName } from "@/components/form";
import { toDateTimeLocalValue } from "@/lib/dates";
import {
  TASK_STATUSES,
  TASK_TYPES,
  type Task,
  type TaskStatus,
  type TaskType,
} from "@/lib/types";
import type { CrudFormState } from "@/lib/validation";

const typeChip: Record<TaskType, string> = {
  assignment: "bg-accent-sky",
  project: "bg-accent-lavender",
  exam: "bg-accent-pink",
  quiz: "bg-accent-sage",
  other: "bg-primary",
};

export function TaskForm({
  action,
  courses,
  task,
  timeZone,
}: {
  action: (state: CrudFormState, formData: FormData) => Promise<CrudFormState>;
  courses: string[];
  task?: Task | null;
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editing = Boolean(task);

  return (
    <FormCard
      wide
      title={editing ? "Edit task" : "Add a task"}
      subtitle="Deadlines and estimates drive the weekly plan."
      notice={state.message}
      tone="error"
    >
      <form action={formAction} className="space-y-4">
        {editing ? <input type="hidden" name="id" value={task?.id} /> : null}

        <Field id="title" label="Title" error={state.errors?.title}>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={task?.title ?? ""}
            className={inputClassName()}
          />
        </Field>

        <Field
          id="course"
          label="Course"
          hint="Pick an existing course or type a new name to create one."
        >
          <input
            id="course"
            name="course"
            type="text"
            list="course-options"
            defaultValue={task?.course_name ?? ""}
            className={inputClassName()}
          />
          <datalist id="course-options">
            {courses.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="type" label="Type" error={state.errors?.type}>
            <select
              id="type"
              name="type"
              defaultValue={task?.type ?? "assignment"}
              className={inputClassName()}
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field id="status" label="Status" error={state.errors?.status}>
            <select
              id="status"
              name="status"
              defaultValue={task?.status ?? "todo"}
              className={inputClassName()}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="deadline" label="Deadline" error={state.errors?.deadline}>
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            required
            defaultValue={task ? toDateTimeLocalValue(task.deadline, timeZone) : ""}
            className={inputClassName()}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field id="grade_weight" label="Weight %" error={state.errors?.grade_weight}>
            <input
              id="grade_weight"
              name="grade_weight"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              required
              defaultValue={task?.grade_weight ?? 0}
              className={inputClassName()}
            />
          </Field>

          <Field id="difficulty" label="Difficulty" error={state.errors?.difficulty}>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue={String(task?.difficulty ?? 3)}
              className={inputClassName()}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <Field id="estimated_hours" label="Hours" error={state.errors?.estimated_hours}>
            <input
              id="estimated_hours"
              name="estimated_hours"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              required
              defaultValue={task?.estimated_hours ?? 1}
              className={inputClassName()}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="is_group"
            defaultChecked={task?.is_group ?? false}
            className="size-4 rounded border-line-strong accent-[color:var(--primary)]"
          />
          Group project
        </label>

        <div className="flex gap-2">
          <SubmitButton pending={pending}>{editing ? "Save changes" : "Add task"}</SubmitButton>
          {editing ? (
            <Link
              href="/tasks"
              className="rounded-pill border border-line-strong bg-card px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-primary/40"
            >
              Cancel
            </Link>
          ) : null}
        </div>
      </form>
    </FormCard>
  );
}

export { typeChip };