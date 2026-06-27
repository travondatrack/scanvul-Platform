import { Resend } from "resend";

type VerificationEmailInput = {
  to: string;
  otp: string;
};

const EMAIL_HTML = (otp: string) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:480px;margin:0 auto">
    <div style="background:#0ea5e9;padding:24px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:#fff;font-size:22px;margin:0">ScanVul AI</h1>
    </div>
    <div style="background:#f9fafb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
      <h2 style="font-size:18px;margin-top:0">Verify your email address</h2>
      <p style="color:#374151">Use the code below to complete your registration. This code expires in <strong>10 minutes</strong>.</p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0ea5e9">${otp}</span>
      </div>
      <p style="color:#6b7280;font-size:13px">If you did not request this code, you can safely ignore this email.</p>
    </div>
  </div>
`;

export async function sendVerificationEmail({ to, otp }: VerificationEmailInput) {
  const resendKey = process.env.RESEND_API_KEY;

  // ── Dev mode fallback ─────────────────────────────────────────────────────
  if (!resendKey) {
    if (process.env.EMAIL_DEV_MODE === "true") {
      console.warn(`[email] EMAIL_DEV_MODE=true — OTP for ${to}: ${otp}`);
      return;
    }
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(resendKey);

  const fromAddress = process.env.RESEND_FROM ?? "ScanVul AI <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Verify your ScanVul AI email",
    html: EMAIL_HTML(otp),
    text: `Your ScanVul AI verification code is: ${otp}. It expires in 10 minutes.`,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
