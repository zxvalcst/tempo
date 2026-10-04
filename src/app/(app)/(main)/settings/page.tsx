import type { Metadata } from "next";
import { ScheduleForm } from "@/components/ScheduleForm";
import { saveSettingsAction } from "@/app/(app)/actions";
import { getProfile } from "@/lib/data/profile";
import { timeZoneOptions } from "@/lib/timezones";
import { toHhMm } from "@/lib/dates";
import { ONBOARDING_DEFAULTS, type OnboardingInput } from "@/lib/types";

export const metadata: Metadata = {
  title: "Settings · Tempo",
};

export default async function SettingsPage() {
  const profile = await getProfile();

  const defaults: OnboardingInput = profile
    ? {
        timezone: profile.timezone,
        sleep_start: toHhMm(profile.sleep_start),
        sleep_end: toHhMm(profile.sleep_end),
        earliest_class_time: profile.earliest_class_time
          ? toHhMm(profile.earliest_class_time)
          : null,
        work_hours_per_day: Number(profile.work_hours_per_day),
        ...(profile.name ? { name: profile.name } : {}),
      }
    : ONBOARDING_DEFAULTS;

  return (
    <ScheduleForm
      action={saveSettingsAction}
      mode="settings"
      defaults={defaults}
      timezones={timeZoneOptions()}
      showName
    />
  );
}
