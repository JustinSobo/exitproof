"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ORG_ADMIN_REQUIRED_MESSAGE,
  requireOrgAdmin,
} from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { getAppUrl, isDemoMode } from "@/lib/env";
import type { MemberRole } from "@/lib/types";

function settingsError(message: string): never {
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

export async function inviteMemberAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOrgAdmin();
  } catch (e) {
    settingsError(
      e instanceof Error ? e.message : ORG_ADMIN_REQUIRED_MESSAGE,
    );
  }

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const roleRaw = String(formData.get("role") || "member");
  const role: MemberRole =
    roleRaw === "admin" ? "admin" : "member";

  if (!email.includes("@")) {
    settingsError("Enter a valid email address.");
  }

  if (isDemoMode()) {
    try {
      demoStore.inviteMember(ctx.org.id, email, role);
    } catch (e) {
      settingsError(e instanceof Error ? e.message : "Invite failed");
    }
    revalidatePath("/settings");
    redirect(`/settings?invited=${encodeURIComponent(email)}`);
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    settingsError(
      "Invites require SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }

  const redirectTo = `${getAppUrl()}/auth/callback`;
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invited_org_id: ctx.org.id },
    });

  if (inviteError || !invited.user) {
    settingsError(inviteError?.message || "Invite email failed");
  }

  const { error: memberError } = await admin.from("organization_members").insert({
    org_id: ctx.org.id,
    user_id: invited.user.id,
    role,
    email,
    full_name: null,
  });

  if (memberError) {
    settingsError(memberError.message);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("audit_events").insert({
    org_id: ctx.org.id,
    case_id: null,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "member.invited",
    payload: { email, role },
  });

  revalidatePath("/settings");
  redirect(`/settings?invited=${encodeURIComponent(email)}`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOrgAdmin();
  } catch (e) {
    settingsError(
      e instanceof Error ? e.message : ORG_ADMIN_REQUIRED_MESSAGE,
    );
  }

  const memberId = String(formData.get("member_id") || "").trim();
  if (!memberId) settingsError("Member id required");

  if (isDemoMode()) {
    try {
      demoStore.removeMember(ctx.org.id, memberId, ctx.user.id);
    } catch (e) {
      settingsError(e instanceof Error ? e.message : "Remove failed");
    }
    revalidatePath("/settings");
    redirect("/settings?removed=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("*")
    .eq("id", memberId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();

  if (!member) settingsError("Member not found");
  if (member.user_id === ctx.user.id) {
    settingsError("You cannot remove yourself");
  }
  if (member.role === "owner") {
    const { count } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", ctx.org.id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      settingsError("Cannot remove the last owner");
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", ctx.org.id);

  if (error) settingsError(error.message);

  await supabase.from("audit_events").insert({
    org_id: ctx.org.id,
    case_id: null,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "member.removed",
    payload: {
      member_id: memberId,
      email: member.email,
      role: member.role,
    },
  });

  revalidatePath("/settings");
  redirect("/settings?removed=1");
}
