import { Resend } from "resend";
import { getSetting } from "../db/index.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function getResendClient(): Resend | null {
  const apiKey = getSetting("resend_api_key");
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function isEmailConfigured(): boolean {
  const apiKey = getSetting("resend_api_key");
  const fromEmail = getSetting("from_email");
  return Boolean(apiKey && fromEmail);
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  const fromEmail = getSetting("from_email");
  if (!fromEmail) {
    return { success: false, error: "From email not configured" };
  }

  const replyTo = getSetting("reply_to") || fromEmail;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      replyTo: replyTo,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function sendInvoiceEmail(
  to: string,
  invoiceNumber: string,
  customerName: string,
  amount: number,
  dueDate: string,
  pdfBuffer: Buffer
): Promise<EmailResult> {
  const businessName = getSetting("business_name") || "OpenAccounting";
  const currency = getSetting("currency") || "USD";

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e1e2e;">Invoice ${invoiceNumber}</h2>
      <p>Dear ${customerName},</p>
      <p>Please find attached invoice <strong>${invoiceNumber}</strong> for <strong>${formattedAmount}</strong>.</p>
      <p><strong>Due Date:</strong> ${dueDate}</p>
      <p>If you have any questions, please don't hesitate to reach out.</p>
      <p style="margin-top: 30px;">
        Best regards,<br/>
        <strong>${businessName}</strong>
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Invoice ${invoiceNumber} from ${businessName}`,
    html,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendPaymentReminder(
  to: string,
  invoiceNumber: string,
  customerName: string,
  amount: number,
  dueDate: string,
  daysOverdue: number
): Promise<EmailResult> {
  const businessName = getSetting("business_name") || "OpenAccounting";
  const currency = getSetting("currency") || "USD";

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);

  const urgency = daysOverdue > 30 ? "urgent" : daysOverdue > 14 ? "important" : "friendly";

  const subject = urgency === "urgent"
    ? `URGENT: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`
    : urgency === "important"
    ? `Reminder: Invoice ${invoiceNumber} is overdue`
    : `Friendly reminder: Invoice ${invoiceNumber}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgency === 'urgent' ? '#d20f39' : '#1e1e2e'};">Payment Reminder</h2>
      <p>Dear ${customerName},</p>
      <p>This is a ${urgency} reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${formattedAmount}</strong>
         ${daysOverdue > 0 ? `was due on ${dueDate} and is now <strong>${daysOverdue} days overdue</strong>` : `is due on ${dueDate}`}.</p>
      <p>Please arrange payment at your earliest convenience.</p>
      <p>If you have already made payment, please disregard this notice.</p>
      <p style="margin-top: 30px;">
        Best regards,<br/>
        <strong>${businessName}</strong>
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
  });
}
