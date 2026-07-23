"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateCaseStatusAction,
  updateChecklistAction,
} from "@/lib/actions/cases";
import { EvidencePreview } from "@/components/app/evidence-preview";
import { CaseDirectoryStatusPanel } from "@/components/app/case-directory-status";
import { GraphEntraMismatchBanner } from "@/components/app/graph-entra-mismatch";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";
import { controlChipLabel, resolveControlRefs } from "@/lib/compliance";
import {
  isSystemCollectedEvidence,
} from "@/lib/evidence";
import type { CaseDirectoryStatus } from "@/lib/connectors/ad";
import type { DirectorySnapshot } from "@/lib/connectors/graph";
import type {
  AuditEvent,
  CaseStatus,
  ChecklistItem,
  EvidenceFile,
  OffboardingCase,
} from "@/lib/types";

const STATUSES: CaseStatus[] = ["open", "in_progress", "blocked", "closed"];

const EXPORT_FRAMEWORKS = [
  { value: "all", label: "All" },
  { value: "fedramp", label: "FedRAMP" },
  { value: "cmmc-l2", label: "CMMC" },
  { value: "soc2", label: "SOC 2" },
  { value: "iso-27001", label: "ISO 27001" },
  { value: "nist-800-171", label: "800-171" },
] as const;

function groupByCategory(items: ChecklistItem[]) {
  const order: string[] = [];
  const map = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.category || "General";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((category) => ({
    category,
    items: map.get(category)!,
  }));
}

export function CaseDetailClient({
  offboardingCase,
  items: initialItems,
  evidence: initialEvidence,
  audits,
  directoryStatus = null,
  graphSnapshot = null,
}: {
  offboardingCase: OffboardingCase;
  items: ChecklistItem[];
  evidence: EvidenceFile[];
  audits: AuditEvent[];
  directoryStatus?: CaseDirectoryStatus | null;
  graphSnapshot?: DirectorySnapshot | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [status, setStatus] = useState(offboardingCase.status);
  const [message, setMessage] = useState<string | null>(null);
  const [exportFw, setExportFw] = useState<string>("all");
  const [expandedDone, setExpandedDone] = useState<Record<string, boolean>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  function refresh() {
    router.refresh();
  }

  async function onStatusChange(next: CaseStatus) {
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const result = await updateCaseStatusAction(offboardingCase.id, next);
      if (result?.error) {
        setStatus(previous);
        setMessage(result.error);
        return;
      }
      setMessage(null);
      refresh();
    });
  }

  async function markDone(item: ChecklistItem) {
    const nextStatus = item.status === "done" ? "pending" : "done";
    const previous = item.status;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: nextStatus } : i,
      ),
    );
    startTransition(async () => {
      const result = await updateChecklistAction(item.id, {
        status: nextStatus,
      });
      if (result?.error) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: previous } : i,
          ),
        );
        setMessage(result.error);
        return;
      }
      setMessage(null);
      refresh();
    });
  }

  async function saveMeta(item: ChecklistItem, notes: string, ticket: string) {
    startTransition(async () => {
      await updateChecklistAction(item.id, {
        notes,
        ticket_url: ticket,
      });
      setMessage("Saved notes");
      refresh();
    });
  }

  async function uploadEvidence(itemId: string, file: File) {
    const form = new FormData();
    form.set("item_id", itemId);
    form.set("file", file);
    const res = await fetch("/api/evidence/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Upload failed");
      return;
    }
    setEvidence((prev) => [...prev, data.evidence]);
    setMessage(`Uploaded ${file.name}`);
    refresh();
  }

  const done = items.filter((i) => i.status === "done").length;
  const criticalRemaining = items.filter(
    (i) => i.is_critical && i.status !== "done",
  ).length;
  const fwQuery = exportFw === "all" ? "" : `?framework=${exportFw}`;
  const groups = groupByCategory(items);
  const progressPct =
    items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  function toggleDetails(id: string) {
    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderItem(item: ChecklistItem) {
    const files = evidence.filter((e) => e.checklist_item_id === item.id);
    const controls = resolveControlRefs(item.control_refs ?? []).slice(0, 8);
    const detailsOpen =
      openDetails[item.id] ??
      Boolean(item.notes || item.ticket_url || files.length > 0);

    return (
      <article
        key={item.id}
        className={`border-t border-[var(--line)] py-4 ${
          item.status === "done" ? "opacity-70" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-white">{item.title}</h3>
              {item.is_critical ? (
                <Badge variant="danger">Critical</Badge>
              ) : null}
              {item.requires_evidence ? (
                <Badge variant="amber">Evidence required</Badge>
              ) : null}
              {item.is_critical &&
              files.some((f) => isSystemCollectedEvidence(f)) &&
              !files.some((f) => !isSystemCollectedEvidence(f)) &&
              !item.ticket_url?.trim() &&
              item.status !== "done" ? (
                <Badge variant="amber">Needs human attest</Badge>
              ) : null}
              {files.length > 0 ? (
                <span className="text-[10px] text-[var(--fog)]">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {controls.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Control mappings">
                {controls.map((ctrl) => (
                  <Badge
                    key={ctrl.key}
                    variant="control"
                    title={ctrl.guidance}
                    className="normal-case tracking-normal"
                  >
                    {controlChipLabel(ctrl)}
                  </Badge>
                ))}
                {(item.control_refs?.length ?? 0) > controls.length ? (
                  <span className="text-[10px] text-[var(--fog)]">
                    +{(item.control_refs?.length ?? 0) - controls.length} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleDetails(item.id)}
              className={buttonClassName({
                variant: "ghost",
                size: "sm",
                className: "border border-[var(--line)]",
              })}
              aria-expanded={detailsOpen}
              aria-controls={`item-details-${item.id}`}
            >
              {detailsOpen ? "Hide details" : "Details"}
            </button>
            <button
              type="button"
              onClick={() => markDone(item)}
              aria-pressed={item.status === "done"}
              className={buttonClassName({
                variant: item.status === "done" ? "primary" : "secondary",
                size: "sm",
                className:
                  item.status === "done"
                    ? "bg-[var(--teal)]/25 text-[var(--teal-bright)] hover:bg-[var(--teal)]/35"
                    : undefined,
              })}
            >
              {item.status === "done" ? "Done" : "Mark done"}
            </button>
          </div>
        </div>

        {detailsOpen ? (
          <div id={`item-details-${item.id}`} className="mt-3 space-y-3">
            <p className="text-sm text-[var(--fog)]">{item.description}</p>
            {item.evidence_hint ? (
              <p className="rounded-md border border-[var(--line)] bg-black/15 px-3 py-2 text-xs text-[var(--fog)]">
                <span className="font-medium text-[var(--mist)]">Evidence hint:</span>{" "}
                {item.evidence_hint}
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-[var(--fog)]">
                Notes
                <textarea
                  defaultValue={item.notes ?? ""}
                  rows={2}
                  className={fieldControlClass}
                  onBlur={(e) =>
                    saveMeta(item, e.target.value, item.ticket_url ?? "")
                  }
                />
              </label>
              <label className="block text-xs text-[var(--fog)]">
                Ticket URL
                <input
                  defaultValue={item.ticket_url ?? ""}
                  className={fieldControlClass}
                  onBlur={(e) =>
                    saveMeta(item, item.notes ?? "", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="space-y-3 text-sm">
              <label
                className={buttonClassName({
                  variant: "secondary",
                  size: "sm",
                  className: "cursor-pointer",
                })}
              >
                Upload evidence
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadEvidence(item.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {files.map((f) => (
                    <EvidencePreview key={f.id} file={f} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--line)] bg-[#07161f]/95 px-4 py-4 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-syne)] text-2xl font-700 tracking-tight text-white sm:text-3xl">
              {offboardingCase.employee_name}
            </h1>
            <p className="mt-1 truncate text-sm text-[var(--fog)]">
              {offboardingCase.employee_email} · {offboardingCase.template_name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--fog)]">
              <span className="text-white">
                {done}/{items.length} done ({progressPct}%)
              </span>
              <span
                className={
                  criticalRemaining > 0
                    ? "text-[var(--amber)]"
                    : "text-[var(--teal-bright)]"
                }
              >
                {criticalRemaining} critical remaining
              </span>
              <span>Due {offboardingCase.due_date || "—"}</span>
            </div>
            <div
              className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Checklist progress"
            >
              <div
                className="h-full rounded-full bg-[var(--teal)] transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="case-status">
              Case status
            </label>
            <select
              id="case-status"
              value={status}
              onChange={(e) => onStatusChange(e.target.value as CaseStatus)}
              className={`${fieldControlClass} mt-0 w-auto capitalize`}
              disabled={pending}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="export-framework">
              Export framework filter
            </label>
            <select
              id="export-framework"
              value={exportFw}
              onChange={(e) => setExportFw(e.target.value)}
              className={`${fieldControlClass} mt-0 w-auto`}
              aria-label="Export framework filter"
            >
              {EXPORT_FRAMEWORKS.map((f) => (
                <option key={f.value} value={f.value}>
                  Export: {f.label}
                </option>
              ))}
            </select>
            <details className="relative">
              <summary
                className={buttonClassName({
                  variant: "primary",
                  size: "md",
                  className:
                    "list-none marker:content-none [&::-webkit-details-marker]:hidden",
                })}
              >
                Export
              </summary>
              <div className="absolute right-0 z-30 mt-2 min-w-[10rem] rounded-md border border-[var(--line)] bg-[#0b2430] p-1 shadow-xl">
                <a
                  href={`/api/export/${offboardingCase.id}/pdf${fwQuery}`}
                  className="block rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  PDF pack
                </a>
                <a
                  href={`/api/export/${offboardingCase.id}/csv${fwQuery}`}
                  className="block rounded px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  CSV export
                </a>
              </div>
            </details>
          </div>
        </div>
      </div>

      {message ? (
        <Alert variant="success" className="py-2">
          {message}
        </Alert>
      ) : null}

      <GraphEntraMismatchBanner
        caseId={offboardingCase.id}
        initialSnapshot={graphSnapshot}
      />

      <CaseDirectoryStatusPanel status={directoryStatus ?? null} />

      <section className="space-y-8">
        <h2 className="sr-only">Checklist</h2>
        {groups.map(({ category, items: groupItems }) => {
          const openItems = groupItems.filter((i) => i.status !== "done");
          const doneItems = groupItems.filter((i) => i.status === "done");
          const showDone = expandedDone[category] ?? false;
          return (
            <div key={category}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-[family-name:var(--font-syne)] text-lg font-600 text-white">
                  {category}
                </h3>
                <p className="text-xs text-[var(--fog)]">
                  {openItems.length} open · {doneItems.length} done
                </p>
              </div>
              <div className="mt-1">
                {openItems.map(renderItem)}
                {doneItems.length > 0 ? (
                  <div className="border-t border-[var(--line)] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDone((prev) => ({
                          ...prev,
                          [category]: !showDone,
                        }))
                      }
                      className="text-sm text-[var(--fog)] hover:text-white"
                      aria-expanded={showDone}
                    >
                      {showDone ? "Hide" : "Show"} {doneItems.length} completed
                      step{doneItems.length === 1 ? "" : "s"}
                    </button>
                    {showDone ? doneItems.map(renderItem) : null}
                  </div>
                ) : null}
                {openItems.length === 0 && doneItems.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--fog)]">No steps.</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Audit events
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fog)]">
          {audits.map((a) => (
            <li key={a.id} className="border-t border-[var(--line)] pt-2">
              <span className="text-white">{a.event_type}</span> ·{" "}
              {a.actor_email || "system"} ·{" "}
              {new Date(a.created_at).toLocaleString()}
            </li>
          ))}
          {audits.length === 0 ? (
            <li className="text-[var(--fog)]">No audit events yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
