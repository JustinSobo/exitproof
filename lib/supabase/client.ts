import { createBrowserClient } from "@supabase/ssr";
import { getAppUrl } from "@/lib/env";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or use DEMO_MODE=true.",
    );
  }
  return createBrowserClient(url, key);
}

/** Browser helper for Microsoft Entra (Azure) OAuth. Prefer the server action on login/signup pages. */
export async function signInWithMicrosoft() {
  const supabase = createClient();
  return supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email openid profile",
      redirectTo: `${getAppUrl()}/auth/callback`,
    },
  });
}
