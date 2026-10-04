import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Log in · Tempo",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) redirect("/");

  return <LoginForm />;
}