import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";

/**
 * Onboarded guard. Only pages inside this group inherit it. `/onboarding` is a
 * sibling of `(main)`, so the redirect target never inherits this redirect.
 */
export default async function MainLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();

  if (!profile?.onboarded) redirect("/onboarding");

  return <>{children}</>;
}