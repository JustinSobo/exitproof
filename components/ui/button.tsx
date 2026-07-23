import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  primary:
    "bg-[var(--teal)] text-[#04201d] hover:bg-[var(--teal-bright)] disabled:opacity-50",
  secondary:
    "border border-[var(--line)] bg-white/5 text-[var(--mist)] hover:bg-white/10 disabled:opacity-50",
  ghost:
    "text-[var(--fog)] hover:bg-white/5 hover:text-white disabled:opacity-50",
  danger:
    "border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[#ffb4ae] hover:bg-[var(--danger)]/20 disabled:opacity-50",
} as const;

const sizes = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-3 text-sm",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(
    "ep-btn inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[background-color,border-color,color,opacity] duration-150",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: Common & { href: string }) {
  return (
    <Link href={href} className={buttonClassName({ variant, size, className })}>
      {children}
    </Link>
  );
}
