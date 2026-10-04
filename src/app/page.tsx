import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const profile = await getProfile();
  redirect(profile?.onboarded ? "/dashboard" : "/onboarding");
}