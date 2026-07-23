import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

export async function POST(request: Request) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const itemId = String(form.get("item_id") || "");
  const file = form.get("file");

  if (!itemId || !(file instanceof File)) {
    return NextResponse.json({ error: "item_id and file required" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (isDemoMode()) {
    const path = `demo/${ctx.org.id}/${itemId}/${Date.now()}-${safeName}`;
    // Store path only — content not persisted in demo memory
    void bytes;
    const evidence = demoStore.addEvidence(itemId, safeName, path, ctx.user);
    return NextResponse.json({ evidence });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("checklist_items")
    .select("*, offboarding_cases!inner(id, org_id)")
    .eq("id", itemId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const caseRow = item.offboarding_cases as { id: string; org_id: string };
  const path = `${caseRow.org_id}/${caseRow.id}/${itemId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: evidence, error } = await supabase
    .from("evidence_files")
    .insert({
      checklist_item_id: itemId,
      case_id: caseRow.id,
      org_id: caseRow.org_id,
      file_name: safeName,
      storage_path: path,
      uploaded_by: ctx.user.email,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    org_id: caseRow.org_id,
    case_id: caseRow.id,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "evidence.uploaded",
    payload: { item_id: itemId, file_name: safeName },
  });

  return NextResponse.json({ evidence });
}
