import { ButtonLink } from "./button";

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
    <div className="ep-rise rounded-xl border border-dashed border-[var(--line)] bg-white/[0.02] px-6 py-12 text-center">
      <h2 className="font-[family-name:var(--font-syne)] text-lg font-600 text-white">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--fog)]">
        {body}
      </p>
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} className="mt-5" size="md">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
