"use client";

import { useActionState } from "react";
import {
  deleteTaskAction,
  toggleTaskDoneAction,
} from "@/app/(app)/(main)/tasks/actions";
import { secondaryButtonClassName } from "@/components/form";

export function TaskActions({
  taskId,
  title,
  isDone,
  sessionCount,
}: {
  taskId: string;
  title: string;
  isDone: boolean;
  sessionCount: number;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(toggleTaskDoneAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTaskAction, {});

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="id" value={taskId} />
          <input type="hidden" name="next" value={isDone ? "todo" : "done"} />
          <button type="submit" disabled={togglePending} className={secondaryButtonClassName()}>
            {togglePending ? "Saving..." : isDone ? "Reopen" : "Mark done"}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={taskId} />
          <button
            type="submit"
            disabled={deletePending}
            onClick={(event) => {
              // Deleting a task cascades to its sessions, so the count is stated
              // before anything happens.
              const cascade =
                sessionCount > 0
                  ? ` This also removes ${sessionCount} planned session(s) for this task.`
                  : "";

              if (!window.confirm(`Delete "${title}"?${cascade}`)) {
                event.preventDefault();
              }
            }}
            className={secondaryButtonClassName()}
          >
            {deletePending ? "Deleting..." : "Delete"}
          </button>
        </form>
      </div>

      {toggleState.message ? (
        <p className="text-xs text-muted-strong">{toggleState.message}</p>
      ) : null}
      {deleteState.message ? (
        <p className="text-xs text-muted-strong">{deleteState.message}</p>
      ) : null}
    </div>
  );
}