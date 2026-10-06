"use client";

import { useActionState } from "react";
import { generatePlanAction } from "@/app/(app)/actions";

export function GeneratePlanButton() {
  const [state, formAction, pending] = useActionState(generatePlanAction, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Building..." : "Generate plan"}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`max-w-xs rounded-pill px-3 py-1.5 text-xs font-medium text-ink ${
            state.error ? "bg-danger" : "bg-accent-sage"
          }`}
        >
          {state.message}
        </p>
      ) : state.placed !== undefined ? (
        <p role="status" className="rounded-pill bg-accent-sage px-3 py-1.5 text-xs font-medium text-ink">
          {state.placed === 0
            ? "No sessions to place."
            : `Placed ${state.placed} session${state.placed === 1 ? "" : "s"} (v${state.version}).`}
        </p>
      ) : null}
    </form>
  );
}
