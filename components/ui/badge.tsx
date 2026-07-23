import { cn } from "./cn";

const variants = {
  default: "border border-[var(--line)] bg-white/5 text-[var(--fog)]",
  teal: "border border-[var(--teal)]/30 bg-[var(--teal)]/15 text-[var(--teal-bright)]",
  amber: "border border-[var(--amber)]/25 bg-[var(--amber)]/15 text-[var(--amber)]",
  danger: "border border-[var(--danger)]/30 bg-[var(--danger)]/20 text-[#ffb4ae]",
  control:
    "border border-[var(--line)] bg-black/25 font-mono text-[var(--teal-bright)]",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
  title,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
