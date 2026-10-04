import type { ReactNode } from "react";

const noticeTone: Record<"info" | "success" | "error", string> = {
  info: "bg-primary/50 text-ink",
  success: "bg-accent-sage text-ink",
  error: "bg-danger text-ink",
};

export function inputClassName(): string {
  return "w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted-strong focus:border-ink focus:ring-2 focus:ring-ink/15 disabled:opacity-60";
}

export function secondaryButtonClassName(): string {
  return "rounded-pill border border-line-strong bg-card px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-primary/40";
}

export function FormCard({
  title,
  subtitle,
  notice,
  tone = "info",
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  notice?: string;
  tone?: "info" | "success" | "error";
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`w-full ${wide ? "mx-auto mt-4 max-w-md" : "max-w-sm"} rounded-card border border-line bg-card p-7 shadow-soft`}
    >
      <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-strong">{subtitle}</p> : null}

      {notice ? (
        <p
          role="status"
          className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium ${noticeTone[tone]}`}
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? <p className="text-xs text-muted-strong">{hint}</p> : null}
      {children}
      {error ? (
        <p className="inline-block rounded-pill bg-danger/50 px-2 py-0.5 text-xs font-medium text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? "Working..." : children}
    </button>
  );
}
