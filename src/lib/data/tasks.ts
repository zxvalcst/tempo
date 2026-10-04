import { createClient } from "@/lib/supabase/server";
import type { Course, Task, TaskInput, TaskStatus, TaskWithCourse } from "@/lib/types";

/**
 * All the user's tasks, soonest deadline first, with the course name resolved.
 * Courses are fetched alongside and joined here rather than with a PostgREST
 * embed, which keeps the returned shape independent of FK inference.
 */
export async function listTasks(): Promise<TaskWithCourse[]> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) return [];

  const [tasksResult, coursesResult] = await Promise.all([
    supabase.from("tasks").select("*").order("deadline", { ascending: true }).returns<Task[]>(),
    supabase.from("courses").select("*").returns<Course[]>(),
  ]);

  if (tasksResult.error) {
    throw new Error("Could not load your tasks.");
  }
  if (coursesResult.error) {
    throw new Error("Could not load your courses.");
  }

  const courseNames = new Map((coursesResult.data ?? []).map((course) => [course.id, course.name]));

  return (tasksResult.data ?? []).map((task) => ({
    ...task,
    course_name: task.course_id ? courseNames.get(task.course_id) ?? null : null,
  }));
}

export async function createTask(input: TaskInput): Promise<void> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("You must be signed in to add a task.");
  }

  const { error } = await supabase.from("tasks").insert({
    user_id: userData.user.id,
    title: input.title,
    course_id: input.course_id,
    type: input.type,
    deadline: input.deadline,
    grade_weight: input.grade_weight,
    difficulty: input.difficulty,
    estimated_hours: input.estimated_hours,
    is_group: input.is_group,
    status: input.status,
  });

  if (error) {
    throw new Error("Could not save that task.");
  }
}

/** `course_id` is sent explicitly so an edit never silently clears it. */
export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      course_id: input.course_id,
      type: input.type,
      deadline: input.deadline,
      grade_weight: input.grade_weight,
      difficulty: input.difficulty,
      estimated_hours: input.estimated_hours,
      is_group: input.is_group,
      status: input.status,
    })
    .eq("id", id);

  if (error) {
    throw new Error("Could not update that task.");
  }
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);

  if (error) {
    throw new Error("Could not update that task.");
  }
}

/** Cascades to the task's sessions. Focus logs are kept, with task_id cleared. */
export async function deleteTask(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error("Could not delete that task.");
  }
}