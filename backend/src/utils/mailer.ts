import nodemailer from "nodemailer";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const createSmtpTransporter = async () => {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (!smtpHost) {
    return null;
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
  return transporter;
};

export const sendInviteEmail = async (email: string, inviteLink: string) => {
  const smtpFrom = process.env.SMTP_FROM?.trim();
  const transporter = await createSmtpTransporter();

  if (!transporter) {
    return false;
  }

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

export const sendNotificationEmail = async (email: string, message: string) => {
  const smtpFrom = process.env.SMTP_FROM?.trim();
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const transporter = await createSmtpTransporter();
  const safeMessage = escapeHtml(message);

  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from: smtpFrom || "Training Tracker <no-reply@training-tracker.local>",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #241f1b; background: #f7f1eb; padding: 28px;">
        <div style="max-width: 560px; margin: 0 auto; background: #fffaf6; border: 1px solid #ead8cc; border-radius: 12px; overflow: hidden;">
          <div style="background: #2d2824; color: #ffffff; padding: 22px 26px;">
            <p style="margin: 0 0 6px; color: #e6c6b6; font-size: 12px; letter-spacing: 1.8px; text-transform: uppercase;">Profile Training Tracker</p>
            <h2 style="margin: 0; font-size: 24px;">Notification</h2>
          </div>
          <div style="padding: 26px;">
            <div style="margin: 0 0 22px; padding: 18px; background: #fff3eb; border-left: 4px solid #c95d33; border-radius: 8px;">
              <p style="margin: 0; font-size: 17px; font-weight: 700;">${safeMessage}</p>
            </div>
            <p style="margin: 0 0 20px;">
          <a
            href="${frontendUrl}"
                style="display: inline-block; padding: 12px 18px; border-radius: 8px; background: #c95d33; color: #ffffff; text-decoration: none; font-weight: 700;"
          >
            Open Training Tracker
          </a>
        </p>
          </div>
        </div>
      </div>
    `,
    subject: "Training Tracker notification",
    text: `Training Tracker notification\n\n${message}\n\nOpen Training Tracker: ${frontendUrl}`,
    to: email,
  });

  return true;
};
