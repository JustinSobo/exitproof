import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * Short-lived signed URL for evidence preview/thumbnail.
 * Demo returns { demo: true, url: null } — UI shows a graceful stub.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (isDemoMode()) {
    const evidence = demoStore.getEvidenceById(id, ctx.org.id);
    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }
    return NextResponse.json({
      demo: true,
      url: null,
      file_name: evidence.file_name,
      mime_type: evidence.mime_type,
      content_hash: evidence.content_hash,
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: evidence } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!evidence) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const orgId = evidence.org_id as string;
  if (orgId !== ctx.org.id) {
    const { data: child } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .eq("parent_org_id", ctx.org.id)
      .maybeSingle();
    if (!child) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }
  }

  const { data: signed, error } = await supabase.storage
    .from("evidence")
    .createSignedUrl(evidence.storage_path as string, 120);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Could not create signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    demo: false,
    url: signed.signedUrl,
    file_name: evidence.file_name,
    mime_type: evidence.mime_type,
    content_hash: evidence.content_hash,
  });
}
