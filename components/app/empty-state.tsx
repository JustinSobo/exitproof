import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
      <h2 className="font-[family-name:var(--font-syne)] text-lg font-600 text-white">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--fog)]">{body}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
