import { redirect } from "next/navigation";
import { OperatorOnboardWizard } from "@/components/operator/onboard-wizard";
import { requireOperator } from "@/lib/operator/auth";

export const metadata = { title: "Onboard customer · Operator" };

export default async function OperatorOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  try {
    await requireOperator();
  } catch {
    redirect("/auth/login");
  }

  const params = await searchParams;
  return <OperatorOnboardWizard error={params.error ?? null} />;
}
