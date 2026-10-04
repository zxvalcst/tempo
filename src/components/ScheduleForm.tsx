"use client";

import { useActionState } from "react";
import { Field, FormCard, SubmitButton, inputClassName } from "@/components/form";
import type { OnboardingFormState } from "@/lib/validation";
import type { OnboardingInput } from "@/lib/types";

const copy = {
  onboarding: {
    title: "Set up your week",
    subtitle: "The planner uses these to find free time around your classes.",
    submit: "Start planning",
  },
  settings: {
    title: "Your schedule settings",
    subtitle: "The planner uses these to find free time around your classes.",
    submit: "Save settings",
  },
} as const;

export function ScheduleForm({
  action,
  mode,
  defaults,
  timezones,
  showName = false,
}: {
  action: (state: OnboardingFormState, formData: FormData) => Promise<OnboardingFormState>;
  mode: "onboarding" | "settings";
  defaults: OnboardingInput;
  timezones: string[];
  showName?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? defaults;
  const text = copy[mode];

  return (
    <FormCard
      wide
      title={text.title}
      subtitle={text.subtitle}
      notice={state.saved ? "Settings saved." : state.message}
      tone={state.saved ? "success" : "error"}
    >
      <form action={formAction} className="space-y-4">
        {showName ? (
          <Field id="name" label="Name" error={state.errors?.name}>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              defaultValue={values.name ?? ""}
              className={inputClassName()}
            />
          </Field>
        ) : null}

        <Field id="timezone" label="Time zone" error={state.errors?.timezone}>
          <select
            id="timezone"
            name="timezone"
            defaultValue={values.timezone}
            className={inputClassName()}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="sleep_start" label="Sleep starts" error={state.errors?.sleep_start}>
            <input
              id="sleep_start"
              name="sleep_start"
              type="time"
              required
              defaultValue={values.sleep_start}
              className={inputClassName()}
            />
          </Field>

          <Field id="sleep_end" label="Sleep ends" error={state.errors?.sleep_end}>
            <input
              id="sleep_end"
              name="sleep_end"
              type="time"
              required
              defaultValue={values.sleep_end}
              className={inputClassName()}
            />
          </Field>
        </div>

        <Field
          id="earliest_class_time"
          label="Earliest class time"
          hint="Optional. Leave empty if you have no early class."
          error={state.errors?.earliest_class_time}
        >
          <input
            id="earliest_class_time"
            name="earliest_class_time"
            type="time"
            defaultValue={values.earliest_class_time ?? ""}
            className={inputClassName()}
          />
        </Field>

        <Field
          id="work_hours_per_day"
          label="Max work hours per day"
          hint="Between 1 and 16."
          error={state.errors?.work_hours_per_day}
        >
          <input
            id="work_hours_per_day"
            name="work_hours_per_day"
            type="number"
            inputMode="decimal"
            min={1}
            max={16}
            step={0.5}
            required
            defaultValue={values.work_hours_per_day}
            className={inputClassName()}
          />
        </Field>

        <SubmitButton pending={pending}>{text.submit}</SubmitButton>
      </form>
    </FormCard>
  );
}
