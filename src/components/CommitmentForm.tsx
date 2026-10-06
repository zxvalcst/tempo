"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { Field, FormCard, SubmitButton, inputClassName } from "@/components/form";
import { toHhMm } from "@/lib/dates";
import { COMMITMENT_CATEGORIES, DAY_NAMES, type Commitment } from "@/lib/types";
import type { CrudFormState } from "@/lib/validation";

export function CommitmentForm({
  action,
  commitment,
}: {
  action: (state: CrudFormState, formData: FormData) => Promise<CrudFormState>;
  commitment?: Commitment | null;
}) {
  const [state, setState] = useState<CrudFormState>({});
  const [pending, setPending] = useState(false);
  const editing = Boolean(commitment);

  // A recurring block carries a weekday, a one-off carries a date, so only one
  // of the two is ever submitted.
  const [isRecurring, setIsRecurring] = useState(commitment?.is_recurring ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const result = await action({}, formData);
      setState(result);
    } catch (error) {
      console.error("Commitment action failed:", error);
      setState({ message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      wide
      title={editing ? "Edit commitment" : "Add a commitment"}
      subtitle="Fixed blocks the planner works around. They never move."
      notice={state.message}
      tone="error"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {editing ? <input type="hidden" name="id" value={commitment?.id} /> : null}

        <Field id="title" label="Title" error={state.errors?.title}>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={commitment?.title ?? ""}
            className={inputClassName()}
          />
        </Field>

        <Field id="category" label="Category" error={state.errors?.category}>
          <select
            id="category"
            name="category"
            defaultValue={commitment?.category ?? "class"}
            className={inputClassName()}
          >
            {COMMITMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="is_recurring"
            defaultChecked={commitment?.is_recurring ?? true}
            onChange={(event) => setIsRecurring(event.target.checked)}
            className="size-4 rounded border-line-strong accent-primary"
          />
          Repeats every week
        </label>

        {isRecurring ? (
          <Field id="day_of_week" label="Day" error={state.errors?.day_of_week}>
            <select
              id="day_of_week"
              name="day_of_week"
              defaultValue={String(commitment?.day_of_week ?? 1)}
              className={inputClassName()}
            >
              {DAY_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field id="specific_date" label="Date" error={state.errors?.specific_date}>
            <input
              id="specific_date"
              name="specific_date"
              type="date"
              defaultValue={commitment?.specific_date ?? ""}
              className={inputClassName()}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field id="start_time" label="Starts" error={state.errors?.start_time}>
            <input
              id="start_time"
              name="start_time"
              type="time"
              required
              defaultValue={commitment ? toHhMm(commitment.start_time) : ""}
              className={inputClassName()}
            />
          </Field>

          <Field id="end_time" label="Ends" error={state.errors?.end_time}>
            <input
              id="end_time"
              name="end_time"
              type="time"
              required
              defaultValue={commitment ? toHhMm(commitment.end_time) : ""}
              className={inputClassName()}
            />
          </Field>
        </div>

        <div className="flex gap-2">
          <SubmitButton pending={pending}>
            {editing ? "Save changes" : "Add commitment"}
          </SubmitButton>
          {editing ? (
            <Link
              href="/commitments"
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