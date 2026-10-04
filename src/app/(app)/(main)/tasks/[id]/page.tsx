import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TaskForm } from "@/components/TaskForm";
import { updateTaskAction } from "@/app/(app)/(main)/tasks/actions";
import { listCourses } from "@/lib/data/courses";
import { getProfile } from "@/lib/data/profile";
import { getTask } from "@/lib/data/tasks";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Edit task · Tempo",
};

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Checked here too, so a hand-typed id 404s instead of reaching Postgres.
  if (!isUuid(id)) notFound();

  const [profile, task, courses] = await Promise.all([
    getProfile(),
    getTask(id),
    listCourses(),
  ]);

  if (!profile) redirect("/onboarding");
  if (!task) notFound();

  return (
    <TaskForm
      action={updateTaskAction}
      courses={courses.map((course) => course.name)}
      task={task}
      timeZone={profile.timezone}
    />
  );
}