import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";

export async function listCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("name", { ascending: true })
    .returns<Course[]>();

  if (error) {
    throw new Error("Could not load your courses.");
  }

  return data;
}

/**
 * Resolves a typed course name to an id, matching existing courses
 * case-insensitively so "Math" and "math" cannot become two courses. Creates
 * the course when nothing matches.
 */
export async function resolveCourse(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (trimmed === "") return null;

  const supabase = await createClient();
  const wanted = trimmed.toLowerCase();

  const { data: existing, error: readError } = await supabase
    .from("courses")
    .select("*")
    .returns<Course[]>();

  if (readError) {
    throw new Error("Could not load your courses.");
  }

  const match = (existing ?? []).find((course) => course.name.toLowerCase() === wanted);
  if (match) return match.id;

  const { data: created, error: writeError } = await supabase
    .from("courses")
    .insert({ name: trimmed })
    .select("*")
    .returns<Course[]>()
    .single();

  if (writeError || !created) {
    throw new Error("Could not create that course.");
  }

  return created.id;
}