import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <span className="text-base font-bold tracking-tight text-ink">Tempo</span>
          <div className="flex items-center gap-3">
            <AppNav />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
