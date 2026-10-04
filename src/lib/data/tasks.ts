import { createClient } from "@/lib/supabase/server";
import type { Course, Task, TaskInput, TaskStatus, TaskWithCourse } from "@/lib/types";

/**
 * Resolves the course name for each task. Courses are fetched separately and
 * joined here rather than with a PostgREST embed, which keeps the returned
 * shape independent of FK inference.
 */
async function withCourseNames(tasks: Task[]): Promise<TaskWithCourse[]> {
  const supabase = await createClient();
  const { data: courses, error } = await supabase.from("courses").select("*").returns<Course[]>();

  if (error) {
    throw new Error("Could not load your courses.");
  }

  const courseNames = new Map((courses ?? []).map((course) => [course.id, course.name]));

  return tasks.map((task) => ({
    ...task,
    course_name: task.course_id ? courseNames.get(task.course_id) ?? null : null,
  }));
}

/** All the user's tasks, soonest deadline first. */
export async function listTasks(): Promise<TaskWithCourse[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("deadline", { ascending: true })
    .returns<Task[]>();

  if (error) {
    throw new Error("Could not load your tasks.");
  }

  return withCourseNames(data ?? []);
}

/** One task with its course name, or null when it does not exist. */
export async function getTask(id: string): Promise<TaskWithCourse | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .returns<Task[]>()
    .maybeSingle();

  if (error) {
    throw new Error("Could not load that task.");
  }

  if (!data) return null;

  const [task] = await withCourseNames([data]);
  return task;
}

/**
 * How many sessions each task owns. Deleting a task cascades to all of them, so
 * the list uses this to warn before the delete goes through.
 */
export async function listTaskSessionCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("sessions").select("task_id").returns<
    Array<{ task_id: string }>
  >();

  if (error) {
    throw new Error("Could not load your planned sessions.");
  }

  const counts: Record<string, number> = {};

  for (const row of data ?? []) {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
  }

  return counts;
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