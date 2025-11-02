type MailOptions = {
  subject: string;
  html: string;
  recipients?: string[];
};

let transporter: any | null = null;
let transporterInitialized = false;

async function ensureTransporter(): Promise<any | null> {
  if (transporterInitialized) {
    return transporter;
  }

  transporterInitialized = true;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn(
      "[email] SMTP configuration missing. Emails will be logged to the console instead of being sent."
    );
    return null;
  }

  try {
    const nodemailer: any = await import("nodemailer");
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  } catch (error) {
    console.warn("[email] Failed to initialize SMTP transporter:", error);
    transporter = null;
  }

  return transporter;
}

function getRecipients(): string[] {
  const recipients =
    process.env.MAINTENANCE_NOTIFY_RECIPIENTS ||
    [
      process.env.MAINTENANCE_NOTIFY_HOD_EMAIL,
      process.env.MAINTENANCE_NOTIFY_MANAGER_EMAIL,
      process.env.MAINTENANCE_NOTIFY_SUPERVISOR_EMAIL,
    ]
      .filter(Boolean)
      .join(",");

  if (!recipients) {
    console.warn("[email] No maintenance notification recipients configured.");
    return [];
  }

  return recipients
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

export async function sendMaintenanceEmail(options: MailOptions) {
  const recipients = options.recipients && options.recipients.length > 0 ? options.recipients : getRecipients();
  if (recipients.length === 0) {
    console.warn("[email] Skipping email because no recipients are configured.");
    return;
  }

  const transport = await ensureTransporter();

  if (!transport) {
    console.log("[email] Mock send:", {
      to: recipients,
      subject: options.subject,
      html: options.html,
    });
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipients,
      subject: options.subject,
      html: options.html,
    });
  } catch (error) {
    console.error("[email] Failed to send maintenance email:", error);
  }
}
