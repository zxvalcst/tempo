"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveCourse } from "@/lib/data/courses";
import { createTask, deleteTask, setTaskStatus, updateTask } from "@/lib/data/tasks";
import {
  hasErrors,
  isUuid,
  parseTaskForm,
  validateTask,
  type CrudFormState,
} from "@/lib/validation";

/** The datalist sends a course name; `resolveCourse` turns it into an id. */
function courseName(formData: FormData): string {
  return String(formData.get("course") ?? "");
}

export async function createTaskAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const values = parseTaskForm(formData);
  const errors = validateTask(values);

  if (hasErrors(errors)) return { errors };

  try {
    await createTask({ ...values, course_id: await resolveCourse(courseName(formData)) });
  } catch {
    return { message: "Could not save that task. Please try again." };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTaskAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { message: "That task no longer exists." };

  const values = parseTaskForm(formData);
  const errors = validateTask(values);

  if (hasErrors(errors)) return { errors };

  try {
    await updateTask(id, { ...values, course_id: await resolveCourse(courseName(formData)) });
  } catch {
    return { message: "Could not update that task. Please try again." };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}
export async function toggleTaskDoneAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!isUuid(id)) return { message: "That task no longer exists." };
  if (next !== "done" && next !== "todo") return { message: "That status is not allowed." };

  try {
    await setTaskStatus(id, next);
  } catch {
    return { message: "Could not update that task." };
  }

  revalidatePath("/tasks");
  return {};
}

export async function deleteTaskAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const id = String(formData.get("id") ?? "");

  if (!isUuid(id)) return { message: "That task no longer exists." };

  try {
    await deleteTask(id);
  } catch {
    return { message: "Could not delete that task." };
  }

  revalidatePath("/tasks");
  return {};
}