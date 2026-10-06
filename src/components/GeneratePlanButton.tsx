"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { generatePlanAction, clearPlanAction } from "@/app/(app)/actions";
import { secondaryButtonClassName } from "@/components/form";

export function GeneratePlanButton() {
  const [genState, genAction, genPending] = useActionState(generatePlanAction, {});
  const [clearState, clearAction, clearPending] = useActionState(clearPlanAction, {});
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const pending = genPending || clearPending;

  // Derive current notifications from state (memoized to stabilize effect deps)
  const notifications = useMemo(
    (): Array<{ id: number; message: string; error: boolean }> => [
      ...(genState.message && genState.error
        ? [{ id: 1, message: genState.message, error: true }]
        : []),
      ...(genState.message && !genState.error
        ? [{ id: 2, message: genState.message, error: false }]
        : []),
      ...(clearState.message
        ? [{ id: 3, message: clearState.message, error: !!clearState.error }]
        : []),
    ],
    [genState.message, genState.error, clearState.message, clearState.error],
  );

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    // Copy ref to local variable for cleanup
    const timers = timersRef.current;
    const prevIds = new Set(visibleIds);

    // Clear timers for ids that are no longer present
    for (const [id, timer] of timers) {
      if (!notifications.some((n) => n.id === id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }

    // Set timers for new notifications (defer setState to avoid synchronous cascading renders)
    for (const n of notifications) {
      if (!prevIds.has(n.id)) {
        // Use setTimeout to defer the setState call, making it asynchronous
        const timer = setTimeout(() => {
          setVisibleIds((current) => {
            const next = new Set(current);
            next.delete(n.id);
            return next;
          });
          timers.delete(n.id);
        }, 5000);
        timers.set(n.id, timer);
      }
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [notifications, visibleIds]);

  const visibleNotifications = notifications.filter((n) => visibleIds.has(n.id));

  return (
    <div className="flex flex-col items-end gap-3 w-full max-w-xs relative">
      {/* Notifications - fixed position top right */}
      {visibleNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {visibleNotifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-card border border-line-strong px-4 py-3 shadow-soft text-sm font-medium text-ink ${
                n.error ? "bg-danger" : "bg-accent-sage"
              }`}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full flex-row gap-2">
        <form action={genAction} className="flex-1">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-pill bg-primary px-4 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
          >
            {genPending ? "Building..." : "Generate plan"}
          </button>
        </form>

        <form action={clearAction}>
          <button
            type="submit"
            disabled={pending}
            className={secondaryButtonClassName()}
          >
            {clearPending ? "Clearing..." : "Clear plan"}
          </button>
        </form>
      </div>

      {/* Summary and status below buttons */}
      {genState.placed !== undefined && !genState.message && (
        <>
          <p role="status" className="max-w-xs rounded-pill bg-accent-sage px-3 py-1.5 text-xs font-medium text-ink">
            {genState.placed === 0
              ? "No sessions to place."
              : `Placed ${genState.placed} session${genState.placed === 1 ? "" : "s"} (v${genState.version}).`}
          </p>
          {genState.summary && (
            <p role="status" className="max-w-xs rounded-card bg-card border border-line px-3 py-2 text-xs text-ink">
              {genState.summary}
            </p>
          )}
          {genState.aiUnavailable && (
            <p role="status" className="max-w-xs rounded-card bg-card border border-line px-3 py-1.5 text-xs text-muted-strong">
              Using standard explanations
            </p>
          )}
        </>
      )}
    </div>
  );
}
