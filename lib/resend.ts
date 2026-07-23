import { Resend } from "resend";
import { hasResend } from "@/lib/env";

export async function sendOverdueEmail(input: {
  to: string;
  employeeName: string;
  stepTitle: string;
  caseId: string;
  dueDate: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!hasResend()) {
    console.log("[resend:noop] Overdue critical step email", input);
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL || "ExitProof <onboarding@resend.dev>";
    await resend.emails.send({
      from,
      to: input.to,
      subject: `[ExitProof] Overdue critical step: ${input.stepTitle}`,
      html: `
        <p>A critical offboarding step is overdue.</p>
        <ul>
          <li><strong>Employee:</strong> ${input.employeeName}</li>
          <li><strong>Step:</strong> ${input.stepTitle}</li>
          <li><strong>Due:</strong> ${input.dueDate}</li>
          <li><strong>Case:</strong> ${input.caseId}</li>
        </ul>
        <p>Complete the step and attach evidence in ExitProof.</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error("[resend:error]", err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}
