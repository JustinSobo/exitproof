import { redirect } from "next/navigation";
import { createCaseAction } from "@/lib/actions/cases";
import { getCurrentOrg } from "@/lib/auth";
import { canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { getTemplatesForStack } from "@/lib/templates";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "New offboard" };

export default async function NewCasePage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const org = normalizeMonthlyUsage(ctx.org);
  const gate = canCreateOffboard(org);
  const templates = getTemplatesForStack(org.stack_profile);

  let clientOrgs: Array<{ id: string; name: string }> = [];
  if (org.plan === "agency") {
    if (isDemoMode()) {
      clientOrgs = demoStore.listClientOrgs(org.id);
    } else {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("parent_org_id", org.id);
      clientOrgs = data ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="New offboarding case"
        description="We’ll seed a checklist from your stack profile and selected frameworks."
        actions={
          <ButtonLink href="/cases" variant="ghost" size="sm">
            Back to cases
          </ButtonLink>
        }
      />

      {!gate.allowed ? <Alert variant="warning">{gate.reason}</Alert> : null}

      <form action={createCaseAction} className="space-y-4">
        {org.plan === "agency" && clientOrgs.length > 0 ? (
          <FieldLabel>
            Organization
            <Select name="org_id" defaultValue={org.id}>
              <option value={org.id}>{org.name} (parent)</option>
              {clientOrgs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldLabel>
        ) : (
          <input type="hidden" name="org_id" value={org.id} />
        )}

        <FieldLabel>
          Employee name
          <Input name="employee_name" required disabled={!gate.allowed} autoComplete="off" />
        </FieldLabel>
        <FieldLabel>
          Employee email
          <Input
            name="employee_email"
            type="email"
            required
            disabled={!gate.allowed}
            autoComplete="off"
          />
        </FieldLabel>
        <FieldLabel>
          Template
          <Select name="template_id" disabled={!gate.allowed}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <details className="rounded-md border border-[var(--line)] open:bg-black/10">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-[var(--fog)] marker:content-none [&::-webkit-details-marker]:hidden">
            Optional details
          </summary>
          <div className="space-y-4 border-t border-[var(--line)] px-3 py-4">
            <FieldLabel>
              Assignee email
              <Input
                name="assignee_email"
                type="email"
                defaultValue={ctx.user.email}
                disabled={!gate.allowed}
              />
            </FieldLabel>
            <FieldLabel>
              Due date
              <Input name="due_date" type="date" disabled={!gate.allowed} />
            </FieldLabel>
            <FieldLabel>
              Notes
              <Textarea name="notes" rows={3} disabled={!gate.allowed} />
            </FieldLabel>
          </div>
        </details>
        <Button type="submit" disabled={!gate.allowed}>
          Create case
        </Button>
      </form>
    </div>
  );
}
