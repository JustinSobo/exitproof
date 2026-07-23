import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * Evidence download: live returns a short-lived signed Storage URL (redirect).
 * Demo returns a graceful stub (no real bytes stored).
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

    demoStore.recordEvidenceDownload(id, ctx.user, ctx.org.id);

    const body = [
      "ExitProof demo evidence stub",
      `file: ${evidence.file_name}`,
      `path: ${evidence.storage_path}`,
      `sha256: ${evidence.content_hash ?? "(none)"}`,
      `mime: ${evidence.mime_type ?? "application/octet-stream"}`,
      "",
      "Live mode serves a signed Supabase Storage URL for the real file.",
    ].join("\n");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${evidence.file_name}.demo.txt"`,
      },
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
    .createSignedUrl(evidence.storage_path as string, 60);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Could not create signed URL" },
      { status: 500 },
    );
  }

  await supabase.from("audit_events").insert({
    org_id: orgId,
    case_id: evidence.case_id,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email,
    event_type: "evidence.downloaded",
    payload: {
      evidence_id: id,
      file_name: evidence.file_name,
      content_hash: evidence.content_hash,
    },
  });

  return NextResponse.redirect(signed.signedUrl);
}
