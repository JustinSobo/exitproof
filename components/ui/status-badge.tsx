import { Badge } from "./badge";

const STATUS_VARIANT: Record<
  string,
  "default" | "teal" | "amber" | "danger"
> = {
  open: "default",
  in_progress: "teal",
  blocked: "amber",
  closed: "teal",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"} className="capitalize">
      {label}
    </Badge>
  );
}
