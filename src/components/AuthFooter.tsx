import Link from "next/link";

export function AuthFooter({ action, href, link }: { action: string; href: string; link: string }) {
  return (
    <p className="mt-5 text-center text-sm text-muted-strong">
      {action}{" "}
      <Link
        href={href}
        className="rounded-pill font-semibold text-ink underline decoration-primary decoration-2 underline-offset-4"
      >
        {link}
      </Link>
    </p>
  );
}
