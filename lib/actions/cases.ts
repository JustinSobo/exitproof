"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ORG_ADMIN_REQUIRED_MESSAGE,
  requireOrg,
  requireOrgAdmin,
} from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { defaultTemplateForStack, getTemplateById, templateStepsForOrg } from "@/lib/templates";
import type { CaseStatus, ChecklistItemStatus, StackProfile } from "@/lib/types";

export async function createCaseAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const employeeName = String(formData.get("employee_name") || "").trim();
  const employeeEmail = String(formData.get("employee_email") || "").trim();
  const templateId = String(formData.get("template_id") || "");
  const assigneeEmail = String(formData.get("assignee_email") || "").trim();
  const dueDate = String(formData.get("due_date") || "") || undefined;
  const notes = String(formData.get("notes") || "") || undefined;
  const requestedOrgId = String(formData.get("org_id") || "").trim();

  if (!employeeName || !employeeEmail) {
    redirect(
      `/cases/new?error=${encodeURIComponent("Employee name and email are required.")}`,
    );
  }

  if (isDemoMode()) {
    let created;
    try {
      created = demoStore.createCase({
        sessionOrgId: ctx.org.id,
        orgId: requestedOrgId || ctx.org.id,
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

  // org_id from client must be current org or an agency child — never arbitrary.
  let orgId = ctx.org.id;
  let selectedFrameworks = ctx.org.selected_frameworks ?? [];
  let stackProfile = ctx.org.stack_profile;
  if (requestedOrgId && requestedOrgId !== ctx.org.id) {
    const { data: child } = await supabase
      .from("organizations")
      .select("id, selected_frameworks, stack_profile")
      .eq("id", requestedOrgId)
      .eq("parent_org_id", ctx.org.id)
      .maybeSingle();
    if (!child) {
      redirect(
        `/cases/new?error=${encodeURIComponent("Organization not found")}`,
      );
    }
    orgId = child.id;
    selectedFrameworks = Array.isArray(child.selected_frameworks)
      ? (child.selected_frameworks as string[])
      : [];
    stackProfile = (child.stack_profile as StackProfile) || stackProfile;
  }

  const template =
    getTemplateById(templateId) ??
    defaultTemplateForStack(stackProfile);
  const steps = templateStepsForOrg(template, selectedFrameworks);

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
      template_id: template.id,
      template_name: template.name,
      created_by: ctx.user.id,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (error) {
    redirect(`/cases/new?error=${encodeURIComponent(error.message)}`);
  }

  const { data: dbSteps } = await supabase
    .from("template_steps")
    .select("id, sort_order")
    .eq("template_id", template.id)
    .order("sort_order");

  const stepIdByOrder = new Map(
    (dbSteps ?? []).map((s) => [s.sort_order as number, s.id as string]),
  );

  const items = steps.map((step) => ({
    case_id: created.id,
    template_step_id: stepIdByOrder.get(step.sort_order) ?? null,
    title: step.title,
    description: step.description,
    requires_evidence: step.requires_evidence,
    is_critical: step.is_critical,
    status: "pending" as const,
    sort_order: step.sort_order,
    category: step.category,
    evidence_hint: step.evidenceHint || null,
    control_refs: step.controlRefs ?? [],
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("checklist_items")
    .insert(items)
    .select("id, sort_order");

  if (itemsError) {
    redirect(`/cases/new?error=${encodeURIComponent(itemsError.message)}`);
  }

  const { controlUuid } = await import("@/lib/compliance/ids");
  const controlLinks: { checklist_item_id: string; control_id: string }[] = [];
  for (const row of insertedItems ?? []) {
    const step = steps.find((s) => s.sort_order === row.sort_order);
    for (const ref of step?.controlRefs ?? []) {
      const uuid = controlUuid(ref);
      if (uuid) {
        controlLinks.push({
          checklist_item_id: row.id,
          control_id: uuid,
        });
      }
    }
  }
  if (controlLinks.length > 0) {
    await supabase.from("checklist_item_controls").insert(controlLinks);
  }

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
    try {
      demoStore.updateCaseStatus(caseId, status, ctx.user, ctx.org.id);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Case not found" };
    }
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const { assertCanCloseCase } = await import("@/lib/cases/evidence-rules");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("offboarding_cases")
    .select("id, org_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!existing) return { error: "Case not found" };

  if (status === "closed") {
    const { data: items } = await supabase
      .from("checklist_items")
      .select("is_critical, status, title")
      .eq("case_id", caseId);
    try {
      assertCanCloseCase(items ?? []);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Cannot close case" };
    }
  }

  const patch: Record<string, unknown> = { status };
  if (status === "closed") patch.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from("offboarding_cases")
    .update(patch)
    .eq("id", caseId);
  if (error) return { error: error.message };

  await supabase.from("audit_events").insert({
    org_id: existing.org_id,
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
    try {
      demoStore.updateChecklistItem(itemId, patch, ctx.user, ctx.org.id);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Checklist item not found",
      };
    }
    revalidatePath("/cases");
    return { ok: true };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const { assertCanCompleteItem } = await import("@/lib/cases/evidence-rules");
  const supabase = await createClient();

  const { data: current, error: loadError } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (loadError || !current) return { error: "Checklist item not found" };

  if (patch.status === "done") {
    const { data: evidence } = await supabase
      .from("evidence_files")
      .select("checklist_item_id")
      .eq("case_id", current.case_id);
    try {
      assertCanCompleteItem(current, evidence ?? [], patch.ticket_url);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Evidence required",
      };
    }
  }

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
  let ctx;
  try {
    ctx = await requireOrgAdmin();
  } catch (e) {
    redirect(
      `/settings?error=${encodeURIComponent(e instanceof Error ? e.message : ORG_ADMIN_REQUIRED_MESSAGE)}`,
    );
  }
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
  await supabase.from("audit_events").insert({
    org_id: ctx.org.id,
    case_id: null,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "settings.updated",
    payload: { name, stack_profile: stack },
  });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function createClientOrgAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOrgAdmin();
  } catch (e) {
    redirect(
      `/clients?error=${encodeURIComponent(e instanceof Error ? e.message : ORG_ADMIN_REQUIRED_MESSAGE)}`,
    );
  }
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
