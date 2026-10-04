"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-card border border-line bg-danger p-7 shadow-soft">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink/80">We could not load this page. Your data is safe.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-pill bg-primary px-5 py-2 text-sm font-semibold text-ink transition-[filter,transform] hover:brightness-105"
      >
        Try again
      </button>
    </div>
  );
}
