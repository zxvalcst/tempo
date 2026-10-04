import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaskForm } from "@/components/TaskForm";
import { createTaskAction } from "@/app/(app)/(main)/tasks/actions";
import { listCourses } from "@/lib/data/courses";
import { getProfile } from "@/lib/data/profile";

export const metadata: Metadata = {
  title: "Add task · Tempo",
};

export default async function NewTaskPage() {
  const [profile, courses] = await Promise.all([getProfile(), listCourses()]);

  if (!profile) redirect("/onboarding");

  return (
    <TaskForm
      action={createTaskAction}
      courses={courses.map((course) => course.name)}
      timeZone={profile.timezone}
    />
  );
}