import { createClient } from "@/lib/supabase/server";
import type { Commitment, CommitmentInput } from "@/lib/types";

export async function listCommitments(): Promise<Commitment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .order("day_of_week", { ascending: true })
    .returns<Commitment[]>();

  if (error) {
    throw new Error("Could not load your commitments.");
  }

  return data;
}

export async function createCommitment(input: CommitmentInput): Promise<void> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("You must be signed in to add a commitment.");
  }

  const { error } = await supabase.from("commitments").insert({
    user_id: userData.user.id,
    title: input.title,
    category: input.category,
    is_recurring: input.is_recurring,
    day_of_week: input.day_of_week,
    specific_date: input.specific_date,
    start_time: input.start_time,
    end_time: input.end_time,
  });

  if (error) {
    throw new Error("Could not save that commitment.");
  }
}

export async function updateCommitment(id: string, input: CommitmentInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("commitments")
    .update({
      title: input.title,
      category: input.category,
      is_recurring: input.is_recurring,
      day_of_week: input.day_of_week,
      specific_date: input.specific_date,
      start_time: input.start_time,
      end_time: input.end_time,
    })
    .eq("id", id);

  if (error) {
    throw new Error("Could not update that commitment.");
  }
}

export async function deleteCommitment(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("commitments").delete().eq("id", id);

  if (error) {
    throw new Error("Could not delete that commitment.");
  }
}