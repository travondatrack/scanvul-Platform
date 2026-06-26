import nodemailer from "nodemailer";

type VerificationEmailInput = {
  to: string;
  otp: string;
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
      && process.env.SMTP_PORT
      && process.env.SMTP_USER
      && process.env.SMTP_PASS
      && process.env.SMTP_FROM,
  );
}

export async function sendVerificationEmail({ to, otp }: VerificationEmailInput) {
  if (!smtpConfigured()) {
    if (process.env.EMAIL_DEV_MODE === "true") {
      console.warn("EMAIL_DEV_MODE=true: verification email delivery skipped.");
      return;
    }

    throw new Error("SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Verify your ScanVul AI email",
    text: `Your ScanVul AI verification code expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1 style="font-size:20px">Verify your email</h1>
        <p>Use this 6-digit code to finish creating your ScanVul AI account.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>
        <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });
}
