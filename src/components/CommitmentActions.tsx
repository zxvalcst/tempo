"use client";

import { useActionState } from "react";
import { deleteCommitmentAction } from "@/app/(app)/(main)/commitments/actions";
import { secondaryButtonClassName } from "@/components/form";

export function CommitmentActions({
  commitmentId,
  title,
}: {
  commitmentId: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(deleteCommitmentAction, {});

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={commitmentId} />
        <button
          type="submit"
          disabled={pending}
          onClick={(event) => {
            // Commitments are not referenced by anything, so nothing cascades.
            if (!window.confirm(`Delete "${title}"?`)) {
              event.preventDefault();
            }
          }}
          className={secondaryButtonClassName()}
        >
          {pending ? "Deleting..." : "Delete"}
        </button>
      </form>

      {state.message ? <p className="text-xs text-muted-strong">{state.message}</p> : null}
    </div>
  );
}