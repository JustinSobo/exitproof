"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const PAID: Array<{ id: PlanId; name: string; price: number }> = [
  { id: "team", name: "Team", price: 79 },
  { id: "growth", name: "Growth", price: 149 },
  { id: "agency", name: "Agency", price: 249 },
];

function redirectTo(url: string) {
  window.location.assign(url);
}

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
      if (data.url) redirectTo(data.url);
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
      if (data.url) redirectTo(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID.map((p) => {
          const current = currentPlan === p.id;
          return (
            <div
              key={p.id}
              className={`ep-panel p-5 ${current ? "border-[var(--teal)]/50" : ""}`}
            >
              <p className="font-[family-name:var(--font-syne)] text-xl text-white">
                {p.name}
              </p>
              <p className="mt-1 text-[var(--fog)]">${p.price}/mo</p>
              <Button
                type="button"
                disabled={busy !== null || current}
                onClick={() => checkout(p.id)}
                className="mt-4"
                variant={current ? "secondary" : "primary"}
              >
                {current
                  ? "Current plan"
                  : busy === p.id
                    ? "Redirecting…"
                    : "Subscribe"}
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={openPortal}
        disabled={busy !== null}
        variant="secondary"
      >
        {busy === "portal" ? "Opening…" : "Open Stripe Customer Portal"}
      </Button>
    </div>
  );
}
