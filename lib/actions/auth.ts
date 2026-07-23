"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { getAppUrl, isDemoMode } from "@/lib/env";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUpAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const orgName = String(formData.get("org_name") || "").trim();

  if (!email || !password) {
    fail("/auth/signup", "Email and password are required.");
  }

  if (isDemoMode()) {
    try {
      const { token } = demoStore.signup(email, password, fullName || email, orgName);
      const cookieStore = await cookies();
      cookieStore.set(DEMO_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    } catch (e) {
      fail("/auth/signup", e instanceof Error ? e.message : "Signup failed");
    }
    redirect("/dashboard");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) fail("/auth/signup", error.message);
  if (!data.user) fail("/auth/signup", "Signup failed");

  const { data: orgId, error: orgError } = await supabase.rpc(
    "bootstrap_organization",
    {
      p_name: orgName || `${fullName || email}'s Organization`,
      p_stack: "hybrid",
      p_full_name: fullName || null,
      p_email: email,
    },
  );

  if (orgError) fail("/auth/signup", orgError.message);
  if (!orgId) fail("/auth/signup", "Failed to create organization");

  redirect("/dashboard");
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const mode = String(formData.get("mode") || "password");

  if (!email) fail("/auth/login", "Email is required.");

  if (isDemoMode()) {
    try {
      const result =
        mode === "magic"
          ? demoStore.magicLink(email)
          : demoStore.login(email, password || "demo1234");
      const cookieStore = await cookies();
      cookieStore.set(DEMO_SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    } catch (e) {
      fail("/auth/login", e instanceof Error ? e.message : "Login failed");
    }
    redirect("/dashboard");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  if (mode === "magic") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${getAppUrl()}/auth/callback` },
    });
    if (error) fail("/auth/login", error.message);
    redirect("/auth/login?message=Check+your+email+for+the+magic+link.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/auth/login", error.message);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
    demoStore.logout(token);
    cookieStore.delete(DEMO_SESSION_COOKIE);
    redirect("/");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function enterDemoAction(): Promise<void> {
  if (!isDemoMode()) {
    redirect("/auth/login?error=" + encodeURIComponent("Demo mode is not enabled on this deployment."));
  }
  const { token } = demoStore.login("demo@exitproof.app", "demo1234");
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/dashboard");
}
