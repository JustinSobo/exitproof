import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/env";
import { ensureOrgMembershipAfterAuth } from "@/lib/org-bootstrap";
import { createClient } from "@/lib/supabase/server";

function fullNameFromUser(user: {
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.display_name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError =
    searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${getAppUrl()}/auth/login?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        await ensureOrgMembershipAfterAuth({
          userId: user.id,
          email: user.email,
          fullName: fullNameFromUser(user),
        });
      }
    } catch (err) {
      console.error("Auth callback error", err);
      const message =
        err instanceof Error ? err.message : "Sign-in could not be completed.";
      return NextResponse.redirect(
        `${getAppUrl()}/auth/login?error=${encodeURIComponent(message)}`,
      );
    }
  }

  return NextResponse.redirect(`${getAppUrl()}${next}`);
}
