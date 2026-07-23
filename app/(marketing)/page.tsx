import Link from "next/link";
import { PLANS } from "@/lib/billing/plans";
import { enterDemoAction } from "@/lib/actions/auth";

const paidPlans = [PLANS.team, PLANS.growth, PLANS.agency];

export default function LandingPage() {
  return (
    <div>
      {/* Hero — brand dominant, one composition, full-bleed atmosphere */}
      <section className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
        <div className="ep-shine absolute inset-x-0 top-10 -z-0 mx-auto h-[420px] max-w-4xl rounded-[2rem] border border-[var(--line)] bg-[radial-gradient(circle_at_30%_20%,rgba(31,196,181,0.18),transparent_55%),linear-gradient(145deg,rgba(15,42,56,0.65),rgba(7,22,31,0.4))]" />

        <div className="relative z-10 max-w-3xl">
          <p className="ep-rise font-[family-name:var(--font-syne)] text-5xl font-800 tracking-tight text-white sm:text-7xl md:text-8xl">
            Exit<span className="text-[var(--teal-bright)]">Proof</span>
          </p>
          <h1 className="ep-rise-delay mt-6 max-w-2xl font-[family-name:var(--font-syne)] text-2xl font-600 leading-snug text-[var(--mist)] sm:text-3xl">
            Audit-ready IT offboarding — checklists, evidence, and exportable
            proof.
          </h1>
          <p className="ep-rise-delay-2 mt-4 max-w-xl text-base leading-relaxed text-[var(--fog)] sm:text-lg">
            Guide every access revocation with stack-aware steps, attach
            evidence, keep an append-only audit trail, and ship a PDF/CSV
            Evidence Pack when auditors ask.
          </p>
          <div className="ep-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/signup"
              className="rounded-md bg-[var(--teal)] px-5 py-3 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)]"
            >
              Start 3 free offboards
            </Link>
            <form action={enterDemoAction}>
              <button
                type="submit"
                className="rounded-md border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
              >
                Open live demo
              </button>
            </form>
          </div>
        </div>

        <div className="ep-pulse pointer-events-none absolute bottom-10 right-6 hidden h-28 w-28 rounded-full border border-[var(--teal-bright)]/40 md:block" />
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Built for the moment access must die cleanly
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--fog)]">
          Seeded from public SOC 2, ISO 27001, and NIST-style access-revocation
          practice — Microsoft 365, Google Workspace, and hybrid SaaS.
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Stack-aware templates",
              body: "Pick M365, Google, or hybrid. Critical steps require evidence before you close.",
            },
            {
              title: "Evidence that sticks",
              body: "Upload screenshots and exports to storage. Notes and ticket URLs travel with every step.",
            },
            {
              title: "Evidence Pack export",
              body: "One click PDF + CSV for auditors — case summary, checklist, attachments, audit events.",
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-[var(--line)] pt-5">
              <h3 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fog)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Simple paid plans
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--fog)]">
          Start with 3 free offboards on the trial gate — then subscribe to
          Team, Growth, or Agency when you are ready.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {paidPlans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-[var(--line)] bg-white/[0.04] p-6"
            >
              <p className="text-sm uppercase tracking-[0.14em] text-[var(--teal-bright)]">
                {plan.name}
              </p>
              <p className="mt-3 font-[family-name:var(--font-syne)] text-4xl font-700 text-white">
                ${plan.priceMonthly}
                <span className="text-base font-500 text-[var(--fog)]">/mo</span>
              </p>
              <p className="mt-2 text-sm text-[var(--fog)]">{plan.tagline}</p>
              <ul className="mt-5 space-y-2 text-sm text-[var(--mist)]">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[var(--teal-bright)]">▹</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
              >
                Choose {plan.name}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
