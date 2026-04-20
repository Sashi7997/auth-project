import nodemailer from "nodemailer";

export const sendInviteEmail = async (email: string, inviteLink: string) => {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim();

  if (!smtpHost) {
    return false;
  }

  if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
    throw new Error("SMTP configuration is incomplete. Set both SMTP_USER and SMTP_PASS.");
  }

  const transporter = nodemailer.createTransport({
    auth: smtpUser
      ? {
          pass: smtpPass,
          user: smtpUser,
        }
      : undefined,
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
  });

  await transporter.verify();

  await transporter.sendMail({
    from: smtpFrom || "Training Tracker <no-reply@training-tracker.local>",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1a17;">
        <h2 style="margin-bottom: 8px;">You have been invited to Profile Training Tracker</h2>
        <p style="margin: 0 0 16px;">
          Complete your training profile and set up access using the secure link below.
        </p>
        <p style="margin: 0 0 20px;">
          <a
            href="${inviteLink}"
            style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #c95d33; color: #ffffff; text-decoration: none; font-weight: 700;"
          >
            Set Up Your Profile
          </a>
        </p>
        <p style="margin: 0; color: #5f564f;">
          If the button does not open, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; color: #5f564f;">${inviteLink}</p>
      </div>
    `,
    subject: "Complete your training profile",
    text: `You have been invited to complete your training profile: ${inviteLink}`,
    to: email,
  });

  return true;
};
