import { Resend } from "resend";
import { hasResend } from "@/lib/env";

/** Escape untrusted values before interpolating into HTML email bodies. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

  const employeeName = escapeHtml(input.employeeName);
  const stepTitle = escapeHtml(input.stepTitle);
  const dueDate = escapeHtml(input.dueDate);
  const caseId = escapeHtml(input.caseId);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.RESEND_FROM_EMAIL || "ExitProof <onboarding@resend.dev>";
    await resend.emails.send({
      from,
      to: input.to,
      subject: `[ExitProof] Overdue critical step: ${input.stepTitle.replace(/[\r\n]+/g, " ")}`,
      html: `
        <p>A critical offboarding step is overdue.</p>
        <ul>
          <li><strong>Employee:</strong> ${employeeName}</li>
          <li><strong>Step:</strong> ${stepTitle}</li>
          <li><strong>Due:</strong> ${dueDate}</li>
          <li><strong>Case:</strong> ${caseId}</li>
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
