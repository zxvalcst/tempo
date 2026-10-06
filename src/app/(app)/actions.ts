"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listCommitments } from "@/lib/data/commitments";
import { getProfile, saveOnboarding } from "@/lib/data/profile";
import {
  completedMinutesByTask,
  deleteAllPlanned,
  deleteFuturePlanned,
  insertPlannedBatch,
  listFixedSessions,
  maxPlanVersion,
} from "@/lib/data/sessions";
import { listTasks } from "@/lib/data/tasks";
import { buildWeek } from "@/lib/planner/schedule";
import { explainPlan } from "@/lib/planner/llm";
import { validatePlan } from "@/lib/planner/validate";
import { createClient } from "@/lib/supabase/server";
import {
  hasErrors,
  parseOnboardingForm,
  validateOnboarding,
  validateSettings,
  type OnboardingFormState,
  type PlanFormState,
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

export async function generatePlanAction(): Promise<PlanFormState> {
  const now = new Date();

  try {
    const profile = await getProfile();

    if (!profile?.onboarded) {
      return { message: "Finish setting up your week first.", error: true };
    }

    const [tasks, commitments, fixedSessions, completed, previousVersion] = await Promise.all([
      listTasks(),
      listCommitments(),
      listFixedSessions(),
      completedMinutesByTask(),
      maxPlanVersion(),
    ]);

    const { sessions } = buildWeek(profile, tasks, commitments, fixedSessions, completed, now);

    // The gate. Deterministic output cannot fail this today; it exists so the
    // same check covers LLM output when that arrives.
    const verdict = validatePlan(
      sessions,
      { tasks, profile, commitments, fixedSessions },
      now,
    );

    if (!verdict.ok) {
      const first = verdict.problems[0];

      return {
        message: `Could not build a valid plan: ${first?.message ?? "unknown problem"}`,
        error: true,
      };
    }

    // Ask the LLM to rewrite explanations and provide a weekly summary.
    // On any failure, we keep the deterministic reasons from buildWeek.
    let summary: string | undefined;
    let aiUnavailable = false;

    const llmResult = await explainPlan(tasks, sessions, profile);
    if (llmResult) {
      // Map LLM reasons back to sessions by index
      const reasonsByIndex = new Map(llmResult.reasons.map((r) => [r.index, r.reason]));
      for (let i = 0; i < sessions.length; i++) {
        const llmReason = reasonsByIndex.get(i);
        if (llmReason) {
          sessions[i].reason = llmReason;
        }
      }
      summary = llmResult.summary;
    } else {
      aiUnavailable = true;
    }

    const version = previousVersion + 1;

    await deleteFuturePlanned(now.toISOString());
    await insertPlannedBatch(sessions, version);

    revalidatePath("/dashboard");
    revalidatePath("/tasks");

    if (sessions.length === 0) {
      return {
        placed: 0,
        version,
        message: "Nothing to schedule: no open tasks are due in the next 7 days.",
        aiUnavailable,
      };
    }

    return { placed: sessions.length, version, summary, aiUnavailable };
  } catch {
    return { message: "Could not build your plan. Please try again.", error: true };
  }
}

/**
 * Clears the current plan by deleting ALL `planned` sessions.
 * `done`, `skipped`, and `moved` sessions are preserved.
 */
export async function clearPlanAction(): Promise<PlanFormState> {
  try {
    await deleteAllPlanned();
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    return { message: "Plan cleared.", placed: 0, version: 0 };
  } catch {
    return { message: "Could not clear your plan. Please try again.", error: true };
  }
}