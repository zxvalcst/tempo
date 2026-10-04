"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveCourse } from "@/lib/data/courses";
import { createTask, deleteTask, setTaskStatus, updateTask } from "@/lib/data/tasks";
import {
  hasErrors,
  parseTaskForm,
  validateTask,
  type CrudFormState,
} from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createTaskAction(
  _prev: CrudFormState,
  formData: FormData,
): Promise<CrudFormState> {
  const values = parseTaskForm(formData);
  const errors = validateTask(values);

  if (hasErrors(errors)) return { errors };

  try {
    const courseId = values.course_id ?? (await resolveCourse(String(formData.get("course") ?? "")));

    await createTask({ ...values, course_id: courseId });
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
  if (!UUID.test(id)) return { message: "That task no longer exists." };

  const values = parseTaskForm(formData);
  const errors = validateTask(values);

  if (hasErrors(errors)) return { errors };

  try {
    const courseId = values.course_id ?? (await resolveCourse(String(formData.get("course") ?? "")));

    await updateTask(id, { ...values, course_id: courseId });
  } catch {
    return { message: "Could not update that task. Please try again." };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function toggleTaskDoneAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!UUID.test(id) || (next !== "done" && next !== "todo")) return;

  try {
    await setTaskStatus(id, next);
  } catch {
    return;
  }

  revalidatePath("/tasks");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  try {
    await deleteTask(id);
  } catch {
    return;
  }

  revalidatePath("/tasks");
}