import { createClient } from "@/lib/supabase/server";
import type { OnboardingInput, Profile } from "@/lib/types";

/**
 * The caller's own profile row, or null when there is no session. RLS already
 * scopes this to the owner, so no user id is accepted from the caller.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .returns<Profile[]>()
    .maybeSingle();

  if (error) {
    throw new Error("Could not load your profile.");
  }

  return data;
}

/**
 * Upsert on `id` with no status filter, so the same call covers first-time
 * onboarding and later edits from the settings page. Sets `onboarded` to true
 * idempotently. `name` is written only when the caller supplies it, so an
 * onboarding save cannot clear an existing name.
 */
export async function saveOnboarding(input: OnboardingInput): Promise<void> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("You must be signed in to save your settings.");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userData.user.id,
      timezone: input.timezone,
      sleep_start: input.sleep_start,
      sleep_end: input.sleep_end,
      earliest_class_time: input.earliest_class_time,
      work_hours_per_day: input.work_hours_per_day,
      onboarded: true,
      ...(input.name !== undefined ? { name: input.name } : {}),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error("Could not save your settings.");
  }
}