import Link from "next/link";
import { redirect } from "next/navigation";
import { updateOrgSettingsAction } from "@/lib/actions/cases";
import {
  inviteMemberAction,
  removeMemberAction,
} from "@/lib/actions/members";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentOrg, isOrgAdminRole } from "@/lib/auth";
import { FRAMEWORKS } from "@/lib/compliance/frameworks";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { getTemplatesForStack } from "@/lib/templates";
import type { OrgMember } from "@/lib/types";

export const metadata = { title: "Settings" };

async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  if (isDemoMode()) {
    return demoStore.listMembers(orgId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  return (data ?? []) as OrgMember[];
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    invited?: string;
    removed?: string;
  }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const params = await searchParams;
  const canManage = isOrgAdminRole(ctx.member.role);
  const templates = getTemplatesForStack(ctx.org.stack_profile);
  const members = await listOrgMembers(ctx.org.id);
  const selected = new Set(ctx.org.selected_frameworks ?? []);
  const selectedLabels = FRAMEWORKS.filter((f) => selected.has(f.slug)).map(
    (f) => f.name,
  );

  const ssoStatus = isDemoMode()
    ? {
        label: "Demo mode",
        detail:
          "Microsoft Entra SSO is hidden in demo. Live apps use Continue with Microsoft via Supabase Azure.",
      }
    : ctx.org.entra_tenant_id
      ? {
          label: "Entra tenant linked",
          detail: `Tenant ID: ${ctx.org.entra_tenant_id}`,
        }
      : {
          label: "Microsoft Entra available",
          detail:
            "Members can sign in with Microsoft. Optional tenant lock is not set yet.",
        };

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <PageHeader
        title="Organization settings"
        description="Stack profile, SSO status, and members. Re-run the questionnaire when your frameworks or tools change."
      />

      {params.error ? <Alert variant="danger">{params.error}</Alert> : null}
      {params.saved ? <Alert variant="success">Settings saved.</Alert> : null}
      {params.invited ? (
        <Alert variant="success">
          Invited {params.invited}
          {isDemoMode() ? " (demo — added as member)" : ""}.
        </Alert>
      ) : null}
      {params.removed ? <Alert variant="info">Member removed.</Alert> : null}

      {!canManage ? (
        <Alert variant="info">
          You have member access. Only owners and admins can change settings or
          manage invites.
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          SSO status
        </h2>
        <div className="ep-panel px-4 py-3 text-sm">
          <p className="font-medium text-white">{ssoStatus.label}</p>
          <p className="mt-1 text-[var(--fog)]">{ssoStatus.detail}</p>
        </div>
        <p className="text-sm text-[var(--fog)]">
          Graph directory connector and consent health:{" "}
          <Link
            href="/connectors"
            className="text-[var(--teal-bright)] hover:underline"
          >
            Connectors
          </Link>
          {ctx.org.graph_consent_status
            ? ` · ${ctx.org.graph_consent_status}`
            : ""}
          {ctx.org.auto_evidence_enabled ? " · auto-evidence on" : ""}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
            Frameworks & onboarding
          </h2>
          {canManage ? (
            <ButtonLink href="/onboarding?edit=1" variant="ghost" size="sm">
              Re-run questionnaire
            </ButtonLink>
          ) : null}
        </div>
        <p className="text-sm text-[var(--fog)]">
          {selectedLabels.length > 0
            ? `Selected: ${selectedLabels.join(", ")}`
            : "No frameworks selected yet — complete onboarding to target FedRAMP, CMMC, SOC, and more."}
        </p>
        {selected.has("fedramp") ||
        selected.has("cmmc-l1") ||
        selected.has("cmmc-l2") ? (
          <p className="text-xs text-[var(--amber)]">
            FedRAMP/CMMC selected — new cases escalate evidence-required on
            mapped checklist steps.
          </p>
        ) : null}
        {ctx.org.onboarding_completed_at ? (
          <p className="text-xs text-[var(--fog)]">
            Onboarding completed{" "}
            {new Date(ctx.org.onboarding_completed_at).toLocaleDateString()}.
          </p>
        ) : (
          <p className="text-xs text-[var(--amber)]">
            Onboarding incomplete — checklist templates may be generic until you
            finish the wizard.
          </p>
        )}
      </section>

      {canManage ? (
        <form action={updateOrgSettingsAction} className="space-y-4">
          <FieldLabel>
            Organization name
            <Input name="name" defaultValue={ctx.org.name} required />
          </FieldLabel>
          <fieldset className="space-y-2 text-sm">
            <legend className="text-[var(--fog)]">Stack profile</legend>
            {(
              [
                ["m365", "Microsoft 365"],
                ["google", "Google Workspace"],
                ["hybrid", "Hybrid SaaS"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="stack_profile"
                  value={value}
                  defaultChecked={ctx.org.stack_profile === value}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Button type="submit">Save settings</Button>
        </form>
      ) : (
        <div className="space-y-2 text-sm text-[var(--fog)]">
          <p>
            Organization: <span className="text-white">{ctx.org.name}</span>
          </p>
          <p>
            Stack:{" "}
            <span className="text-white capitalize">{ctx.org.stack_profile}</span>
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Members
        </h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2"
            >
              <div>
                <p className="text-white">{m.full_name || m.email}</p>
                {m.full_name ? (
                  <p className="text-xs text-[var(--fog)]">{m.email}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-[var(--fog)]">
                  {m.role}
                </span>
                {canManage && m.user_id !== ctx.user.id ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
          {members.length === 0 ? (
            <li className="text-[var(--fog)]">No members found.</li>
          ) : null}
        </ul>
        {canManage ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-sm">
            <p className="font-medium text-white">Invite teammates</p>
            <p className="mt-1 text-[var(--fog)]">
              {isDemoMode()
                ? "Demo adds the member instantly (password demo1234)."
                : "Sends a Supabase invite email; they join this org as member or admin."}
            </p>
            <form
              action={inviteMemberAction}
              className="mt-3 flex flex-wrap items-end gap-2"
            >
              <FieldLabel className="min-w-[14rem] flex-1 text-xs">
                Email
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="colleague@company.com"
                />
              </FieldLabel>
              <FieldLabel className="text-xs">
                Role
                <Select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </FieldLabel>
              <Button type="submit">Send invite</Button>
            </form>
          </div>
        ) : null}
      </section>

      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Available templates
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fog)]">
          {templates.map((t) => (
            <li key={t.id} className="border-t border-[var(--line)] pt-2">
              <span className="text-white">{t.name}</span> — {t.steps.length}{" "}
              steps · {t.steps.filter((s) => s.requires_evidence).length} require
              evidence
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
