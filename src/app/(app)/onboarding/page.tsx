import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScheduleForm } from "@/components/ScheduleForm";
import { saveOnboardingAction } from "@/app/(app)/actions";
import { getProfile } from "@/lib/data/profile";
import { ONBOARDING_DEFAULTS, toHhMm, type OnboardingInput } from "@/lib/types";
import { timeZoneOptions } from "@/lib/timezones";

export const metadata: Metadata = {
  title: "Your week · Tempo",
};

export default async function OnboardingPage() {
  const profile = await getProfile();

  // /settings is the only editor once the profile is set up.
  if (profile?.onboarded) redirect("/settings");

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
      action={saveOnboardingAction}
      mode="onboarding"
      defaults={defaults}
      timezones={timeZoneOptions()}
    />
  );
}
