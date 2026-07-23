import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch (err) {
      console.error("Auth callback error", err);
      return NextResponse.redirect(`${getAppUrl()}/auth/login?error=callback`);
    }
  }

  return NextResponse.redirect(`${getAppUrl()}${next}`);
}
