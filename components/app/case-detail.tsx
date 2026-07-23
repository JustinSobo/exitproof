"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateCaseStatusAction,
  updateChecklistAction,
} from "@/lib/actions/cases";
import type {
  AuditEvent,
  CaseStatus,
  ChecklistItem,
  EvidenceFile,
  OffboardingCase,
} from "@/lib/types";

const STATUSES: CaseStatus[] = ["open", "in_progress", "blocked", "closed"];

export function CaseDetailClient({
  offboardingCase,
  items: initialItems,
  evidence: initialEvidence,
  audits,
}: {
  offboardingCase: OffboardingCase;
  items: ChecklistItem[];
  evidence: EvidenceFile[];
  audits: AuditEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [status, setStatus] = useState(offboardingCase.status);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function onStatusChange(next: CaseStatus) {
    setStatus(next);
    startTransition(async () => {
      await updateCaseStatusAction(offboardingCase.id, next);
      refresh();
    });
  }

  async function markDone(item: ChecklistItem) {
    const nextStatus = item.status === "done" ? "pending" : "done";
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: nextStatus } : i,
      ),
    );
    startTransition(async () => {
      await updateChecklistAction(item.id, { status: nextStatus });
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
            {offboardingCase.employee_name}
          </h1>
          <p className="mt-1 text-[var(--fog)]">
            {offboardingCase.employee_email} · {offboardingCase.template_name}
          </p>
          <p className="mt-1 text-sm text-[var(--fog)]">
            Progress {done}/{items.length} · Due {offboardingCase.due_date || "—"} ·
            Assignee {offboardingCase.assignee_email || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as CaseStatus)}
            className="rounded-md border border-[var(--line)] bg-black/30 px-3 py-2 text-sm capitalize text-white"
            disabled={pending}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <a
            href={`/api/export/${offboardingCase.id}/pdf`}
            className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-[#04201d]"
          >
            Export PDF
          </a>
          <a
            href={`/api/export/${offboardingCase.id}/csv`}
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm hover:bg-white/5"
          >
            Export CSV
          </a>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-[var(--teal-bright)]">{message}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Checklist
        </h2>
        {items.map((item) => {
          const files = evidence.filter((e) => e.checklist_item_id === item.id);
          return (
            <article
              key={item.id}
              className="rounded-xl border border-[var(--line)] bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-white">{item.title}</h3>
                    {item.is_critical ? (
                      <span className="rounded bg-[var(--danger)]/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#ffb4ae]">
                        Critical
                      </span>
                    ) : null}
                    {item.requires_evidence ? (
                      <span className="rounded bg-[var(--amber)]/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--amber)]">
                        Evidence required
                      </span>
                    ) : null}
                    <span className="text-xs text-[var(--fog)]">{item.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--fog)]">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => markDone(item)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    item.status === "done"
                      ? "bg-[var(--teal)]/20 text-[var(--teal-bright)]"
                      : "border border-[var(--line)] hover:bg-white/5"
                  }`}
                >
                  {item.status === "done" ? "Done" : "Mark done"}
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block text-xs text-[var(--fog)]">
                  Notes
                  <textarea
                    defaultValue={item.notes ?? ""}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-2 py-1.5 text-sm text-white"
                    onBlur={(e) =>
                      saveMeta(item, e.target.value, item.ticket_url ?? "")
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--fog)]">
                  Ticket URL
                  <input
                    defaultValue={item.ticket_url ?? ""}
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-2 py-1.5 text-sm text-white"
                    onBlur={(e) =>
                      saveMeta(item, item.notes ?? "", e.target.value)
                    }
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="cursor-pointer rounded-md border border-[var(--line)] px-3 py-1.5 hover:bg-white/5">
                  Upload evidence
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadEvidence(item.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {files.map((f) => (
                  <span key={f.id} className="text-[var(--fog)]">
                    📎 {f.file_name}
                  </span>
                ))}
              </div>
            </article>
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
              {a.actor_email || "system"} · {new Date(a.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
