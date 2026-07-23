import { cn } from "./cn";

const variants = {
  info: "border-[var(--line)] bg-white/[0.03] text-[var(--fog)]",
  success:
    "border-[var(--teal)]/40 bg-[var(--teal)]/10 text-[var(--teal-bright)]",
  warning: "border-[var(--amber)]/40 bg-[var(--amber)]/10 text-[var(--mist)]",
  danger: "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[#ffb4ae]",
} as const;

export function Alert({
  children,
  variant = "info",
  className,
  role,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role ?? (variant === "danger" ? "alert" : "status")}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
