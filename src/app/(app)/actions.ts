"use server";

import { redirect } from "next/navigation";
import { saveOnboarding } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import {
  hasErrors,
  parseOnboardingForm,
  validateOnboarding,
  validateSettings,
  type OnboardingFormState,
} from "@/lib/validation";

export async function saveOnboardingAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const values = parseOnboardingForm(formData);
  const errors = validateOnboarding(values);

  if (hasErrors(errors)) {
    return { errors, values };
  }

  try {
    await saveOnboarding(values);
  } catch {
    return { values, message: "Could not save your settings. Please try again." };
  }

  redirect("/");
}

/** Same save, but stays on /settings so the confirmation is visible. */
export async function saveSettingsAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const values = parseOnboardingForm(formData);
  const errors = validateSettings(values);

  if (hasErrors(errors)) {
    return { errors, values };
  }

  try {
    await saveOnboarding(values);
  } catch {
    return { values, message: "Could not save your settings. Please try again." };
  }

  return { values, saved: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}