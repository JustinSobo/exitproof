"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/types";

const PAID: Array<{ id: PlanId; name: string; price: number }> = [
  { id: "team", name: "Team", price: 79 },
  { id: "growth", name: "Growth", price: 149 },
  { id: "agency", name: "Agency", price: 249 },
];

export function BillingActions({ currentPlan }: { currentPlan: PlanId }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Portal failed");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--line)] bg-white/[0.04] p-5"
          >
            <p className="font-[family-name:var(--font-syne)] text-xl text-white">
              {p.name}
            </p>
            <p className="mt-1 text-[var(--fog)]">${p.price}/mo</p>
            <button
              type="button"
              disabled={busy !== null || currentPlan === p.id}
              onClick={() => checkout(p.id)}
              className="mt-4 rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-[#04201d] disabled:opacity-50"
            >
              {currentPlan === p.id
                ? "Current plan"
                : busy === p.id
                  ? "Redirecting…"
                  : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={openPortal}
        disabled={busy !== null}
        className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
      >
        {busy === "portal" ? "Opening…" : "Open Stripe Customer Portal"}
      </button>
    </div>
  );
}
