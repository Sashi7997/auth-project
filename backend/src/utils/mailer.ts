import nodemailer from "nodemailer";

export const sendInviteEmail = async (email: string, inviteLink: string) => {
  if (!process.env.SMTP_HOST) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    auth: process.env.SMTP_USER
      ? {
          pass: process.env.SMTP_PASS,
          user: process.env.SMTP_USER,
        }
      : undefined,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Training Tracker <no-reply@training-tracker.local>",
    html: `<p>You have been invited to complete your training profile.</p><p><a href="${inviteLink}">Set up your profile</a></p>`,
    subject: "Complete your training profile",
    text: `You have been invited to complete your training profile: ${inviteLink}`,
    to: email,
  });

  return true;
};
