import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { sha256Hex } from "@/lib/evidence/hash";
import { validateEvidenceUpload, MAX_EVIDENCE_BYTES } from "@/lib/evidence/validate-upload";

export async function POST(request: Request) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const itemId = String(form.get("item_id") || "");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "item_id and file required" }, { status: 400 });
  }

  const validated = validateEvidenceUpload({
    itemId,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Re-check after read in case declared size was wrong.
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
    return NextResponse.json(
      { error: "File must be 10 MB or smaller" },
      { status: 400 },
    );
  }

  const safeName = validated.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentHash = sha256Hex(bytes);

  if (isDemoMode()) {
    const path = `demo/${ctx.org.id}/${validated.data.itemId}/${Date.now()}-${safeName}`;
    try {
      const evidence = demoStore.addEvidence(
        validated.data.itemId,
        safeName,
        path,
        ctx.user,
        ctx.org.id,
        {
          contentHash,
          mimeType: validated.data.mimeType,
          byteSize: bytes.byteLength,
        },
      );
      return NextResponse.json({ evidence });
    } catch {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("checklist_items")
    .select("*, offboarding_cases!inner(id, org_id)")
    .eq("id", validated.data.itemId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const caseRow = item.offboarding_cases as { id: string; org_id: string };
  const path = `${caseRow.org_id}/${caseRow.id}/${validated.data.itemId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(path, bytes, { contentType: validated.data.mimeType });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: evidence, error } = await supabase
    .from("evidence_files")
    .insert({
      checklist_item_id: validated.data.itemId,
      case_id: caseRow.id,
      org_id: caseRow.org_id,
      file_name: safeName,
      storage_path: path,
      uploaded_by: ctx.user.email,
      mime_type: validated.data.mimeType,
      byte_size: bytes.byteLength,
      content_hash: contentHash,
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
    payload: {
      item_id: validated.data.itemId,
      file_name: safeName,
      mime_type: validated.data.mimeType,
      size: bytes.byteLength,
      content_hash: contentHash,
    },
  });

  return NextResponse.json({ evidence });
}
