import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign up · Tempo",
};

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) redirect("/");

  return <SignupForm />;
}