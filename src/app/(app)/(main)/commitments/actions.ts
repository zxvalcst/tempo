"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCommitment, deleteCommitment, updateCommitment } from "@/lib/data/commitments";
import {
  hasErrors,
  isUuid,
  parseCommitmentForm,
  validateCommitment,
  type CrudFormState,
} from "@/lib/validation";

export async function createCommitmentAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const values = parseCommitmentForm(formData);
  const errors = validateCommitment(values);

  if (hasErrors(errors)) return { errors };

  try {
    await createCommitment(values);
  } catch {
    return { message: "Could not save that commitment. Please try again." };
  }

  revalidatePath("/commitments");
  redirect("/commitments");
}

export async function updateCommitmentAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { message: "That commitment no longer exists." };

  const values = parseCommitmentForm(formData);
  const errors = validateCommitment(values);

  if (hasErrors(errors)) return { errors };

  try {
    await updateCommitment(id, values);
  } catch {
    return { message: "Could not update that commitment. Please try again." };
  }

  revalidatePath("/commitments");
  redirect("/commitments");
}

export async function deleteCommitmentAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { message: "That commitment no longer exists." };

  try {
    await deleteCommitment(id);
  } catch {
    return { message: "Could not delete that commitment." };
  }

  revalidatePath("/commitments");
  return {};
}