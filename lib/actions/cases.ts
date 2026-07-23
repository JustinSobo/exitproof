"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { defaultTemplateForStack, getTemplateById } from "@/lib/templates";
import type { CaseStatus, ChecklistItemStatus, StackProfile } from "@/lib/types";

export async function createCaseAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const employeeName = String(formData.get("employee_name") || "").trim();
  const employeeEmail = String(formData.get("employee_email") || "").trim();
  const templateId = String(formData.get("template_id") || "");
  const assigneeEmail = String(formData.get("assignee_email") || "").trim();
  const dueDate = String(formData.get("due_date") || "") || undefined;
  const notes = String(formData.get("notes") || "") || undefined;
  const orgId = String(formData.get("org_id") || ctx.org.id);

  if (!employeeName || !employeeEmail) {
    redirect(
      `/cases/new?error=${encodeURIComponent("Employee name and email are required.")}`,
    );
  }

  if (isDemoMode()) {
    let created;
    try {
      created = demoStore.createCase({
        orgId,
        user: ctx.user,
        employeeName,
        employeeEmail,
        templateId,
        assigneeEmail,
        dueDate,
        notes,
      });
    } catch (e) {
      redirect(
        `/cases/new?error=${encodeURIComponent(e instanceof Error ? e.message : "Failed to create case")}`,
      );
    }
    redirect(`/cases/${created.id}`);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const template =
    getTemplateById(templateId) ??
    defaultTemplateForStack(ctx.org.stack_profile);

  const { canCreateOffboard, normalizeMonthlyUsage } = await import(
    "@/lib/billing/gates"
  );
  const org = normalizeMonthlyUsage(ctx.org);
  const gate = canCreateOffboard(org);
  if (!gate.allowed) {
    redirect(`/cases/new?error=${encodeURIComponent(gate.reason || "Not allowed")}`);
  }

  const { data: created, error } = await supabase
    .from("offboarding_cases")
    .insert({
      org_id: orgId,
      employee_name: employeeName,
      employee_email: employeeEmail,
      status: "open",
      assignee_email: assigneeEmail || ctx.user.email,
      due_date: dueDate || null,
      template_id: null,
      template_name: template.name,
      created_by: ctx.user.id,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (error) {
    redirect(`/cases/new?error=${encodeURIComponent(error.message)}`);
  }

  const items = template.steps.map((step) => ({
    case_id: created.id,
    template_step_id: null,
    title: step.title,
    description: step.description,
    requires_evidence: step.requires_evidence,
    is_critical: step.is_critical,
    status: "pending" as const,
    sort_order: step.sort_order,
    category: step.category,
  }));

  await supabase.from("checklist_items").insert(items);
  await supabase.from("audit_events").insert({
    org_id: orgId,
    case_id: created.id,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "case.created",
    payload: { employee_name: employeeName, template: template.slug },
  });

  await supabase
    .from("organizations")
    .update({
      offboards_this_month: org.offboards_this_month + 1,
      offboards_month_key: org.offboards_month_key,
      trial_offboards_used:
        org.plan === "trial"
          ? org.trial_offboards_used + 1
          : org.trial_offboards_used,
    })
    .eq("id", org.id);

  redirect(`/cases/${created.id}`);
}

export async function updateCaseStatusAction(
  caseId: string,
  status: CaseStatus,
) {
  const ctx = await requireOrg();

  if (isDemoMode()) {
    demoStore.updateCaseStatus(caseId, status, ctx.user);
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "closed") patch.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from("offboarding_cases")
    .update(patch)
    .eq("id", caseId);
  if (error) return { error: error.message };

  await supabase.from("audit_events").insert({
    org_id: ctx.org.id,
    case_id: caseId,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "case.status_changed",
    payload: { status },
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateChecklistAction(
  itemId: string,
  patch: {
    status?: ChecklistItemStatus;
    notes?: string;
    ticket_url?: string;
  },
) {
  const ctx = await requireOrg();

  if (isDemoMode()) {
    demoStore.updateChecklistItem(itemId, patch, ctx.user);
    revalidatePath("/cases");
    return { ok: true };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "done") {
    update.completed_at = new Date().toISOString();
    update.completed_by = ctx.user.email;
  } else if (patch.status) {
    update.completed_at = null;
    update.completed_by = null;
  }

  const { data: item, error } = await supabase
    .from("checklist_items")
    .update(update)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) return { error: error.message };

  await supabase.from("audit_events").insert({
    org_id: ctx.org.id,
    case_id: item.case_id,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "checklist.updated",
    payload: { item_id: itemId, ...patch },
  });

  revalidatePath(`/cases/${item.case_id}`);
  return { ok: true };
}

export async function updateOrgSettingsAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const name = String(formData.get("name") || "").trim();
  const stack = String(formData.get("stack_profile") || "hybrid") as StackProfile;

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, { name, stack_profile: stack });
    revalidatePath("/settings");
    redirect("/settings?saved=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, stack_profile: stack })
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function createClientOrgAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const name = String(formData.get("name") || "").trim();
  const stack = String(formData.get("stack_profile") || "hybrid") as StackProfile;
  if (!name) {
    redirect(`/clients?error=${encodeURIComponent("Name is required.")}`);
  }

  if (isDemoMode()) {
    try {
      demoStore.createClientOrg(ctx.org.id, name, stack);
    } catch (e) {
      redirect(
        `/clients?error=${encodeURIComponent(e instanceof Error ? e.message : "Failed")}`,
      );
    }
    revalidatePath("/clients");
    redirect("/clients");
  }

  if (ctx.org.plan !== "agency") {
    redirect(
      `/clients?error=${encodeURIComponent("Client organizations require the Agency plan.")}`,
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { count } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("parent_org_id", ctx.org.id);

  if ((count ?? 0) >= 25) {
    redirect(
      `/clients?error=${encodeURIComponent("Agency plan allows up to 25 client organizations.")}`,
    );
  }

  const { error } = await supabase.from("organizations").insert({
    name,
    stack_profile: stack,
    plan: ctx.org.plan,
    parent_org_id: ctx.org.id,
    retention_days: ctx.org.retention_days,
  });

  if (error) {
    redirect(`/clients?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/clients");
  redirect("/clients");
}
