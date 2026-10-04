import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateCommitmentAction } from "@/app/(app)/(main)/commitments/actions";
import { CommitmentForm } from "@/components/CommitmentForm";
import { getCommitment } from "@/lib/data/commitments";
import { getProfile } from "@/lib/data/profile";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Edit commitment · Tempo",
};

export default async function EditCommitmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Checked here too, so a hand-typed id 404s instead of reaching Postgres.
  if (!isUuid(id)) notFound();

  const [profile, commitment] = await Promise.all([getProfile(), getCommitment(id)]);

  if (!profile) redirect("/onboarding");
  if (!commitment) notFound();

  return <CommitmentForm action={updateCommitmentAction} commitment={commitment} />;
}