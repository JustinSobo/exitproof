"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshCaseDirectorySnapshotAction } from "@/lib/actions/connectors";
import type { DirectorySnapshot } from "@/lib/connectors/graph";

/**
 * Case-detail warning when Graph snapshot shows accountEnabled=true.
 */
export function GraphEntraMismatchBanner({
  caseId,
  initialSnapshot,
}: {
  caseId: string;
  initialSnapshot: DirectorySnapshot | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [note, setNote] = useState<string | null>(null);

  if (!snapshot && !note) {
    return (
      <section
        className="ep-panel border border-[var(--line)] bg-black/20 px-4 py-3 text-sm"
        aria-label="Entra Graph status"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[var(--fog)]">
            No Graph directory snapshot yet. Consent must be healthy on{" "}
            <a href="/connectors" className="text-[var(--teal-bright)] hover:underline">
              Connectors
            </a>
            .
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await refreshCaseDirectorySnapshotAction(caseId);
                if (result.error) {
                  setNote(result.error);
                  return;
                }
                if (result.snapshot) setSnapshot(result.snapshot);
                setNote(
                  result.autoEvidenceAttached
                    ? "Snapshot refreshed · auto-evidence attached"
                    : result.message ?? "Snapshot refreshed",
                );
                router.refresh();
              });
            }}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fog)] hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {pending ? "Refreshing…" : "Refresh Graph snapshot"}
          </button>
        </div>
      </section>
    );
  }

  const mismatch = Boolean(snapshot?.accountStillEnabled);

  return (
    <section
      className={`ep-panel space-y-2 px-4 py-3 text-sm ${
        mismatch
          ? "border-[var(--danger)]/40 bg-[var(--danger)]/10"
          : ""
      }`}
      aria-label="Entra Graph status"
      role={mismatch ? "alert" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">
            {mismatch
              ? "Entra account still enabled"
              : snapshot?.user
                ? "Entra account disabled in snapshot"
                : "Graph directory snapshot"}
          </p>
          <p className="mt-1 text-[var(--fog)]">
            {mismatch
              ? `Graph read shows accountEnabled=true for ${snapshot?.user?.userPrincipalName ?? snapshot?.queriedEmail}. Disable sign-in in Entra, then refresh.`
              : snapshot?.note ||
                (snapshot?.user
                  ? `${snapshot.user.userPrincipalName} · accountEnabled=false`
                  : "No matching user in directory.")}
          </p>
          {snapshot ? (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--fog)]">
              Source: {snapshot.source === "demo_mock" ? "demo mock" : "graph"} ·{" "}
              {new Date(snapshot.capturedAt).toLocaleString()}
            </p>
          ) : null}
          {note ? (
            <p className="mt-1 text-xs text-[var(--teal-bright)]">{note}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await refreshCaseDirectorySnapshotAction(caseId);
              if (result.error) {
                setNote(result.error);
                return;
              }
              if (result.snapshot) setSnapshot(result.snapshot);
              setNote(
                result.autoEvidenceAttached
                  ? "Snapshot refreshed · auto-evidence attached"
                  : result.message ?? "Snapshot refreshed",
              );
              router.refresh();
            });
          }}
          className="shrink-0 rounded-md border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fog)] hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh Graph snapshot"}
        </button>
      </div>
    </section>
  );
}
