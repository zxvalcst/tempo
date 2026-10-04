import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createCommitmentAction } from "@/app/(app)/(main)/commitments/actions";
import { CommitmentForm } from "@/components/CommitmentForm";
import { getProfile } from "@/lib/data/profile";

export const metadata: Metadata = {
  title: "Add commitment · Tempo",
};

export default async function NewCommitmentPage() {
  const profile = await getProfile();

  if (!profile) redirect("/onboarding");

  return <CommitmentForm action={createCommitmentAction} />;
}