import Link from "next/link";
import { CommitmentActions } from "@/components/CommitmentActions";
import { secondaryButtonClassName } from "@/components/form";
import { toHhMm } from "@/lib/dates";
import type { Commitment, CommitmentCategory } from "@/lib/types";

const categoryChip: Record<CommitmentCategory, string> = {
  class: "bg-accent-sky",
  org: "bg-accent-lavender",
  church: "bg-accent-sage",
  committee: "bg-accent-pink",
  other: "bg-primary",
};

/** One commitment inside a day group or a dated group. */
export function CommitmentRow({ commitment }: { commitment: Commitment }) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">{commitment.title}</h3>
          <span
            className={`rounded-pill px-2 py-0.5 text-xs font-medium text-ink ${categoryChip[commitment.category]}`}
          >
            {commitment.category}
          </span>
        </div>
        <p className="text-sm text-muted-strong">
          {toHhMm(commitment.start_time)} to {toHhMm(commitment.end_time)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/commitments/${commitment.id}`} className={secondaryButtonClassName()}>
          Edit
        </Link>
        <CommitmentActions commitmentId={commitment.id} title={commitment.title} />
      </div>
    </li>
  );
}