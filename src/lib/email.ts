import { Resend } from "resend";
import { thaiDateLabel } from "@/lib/dates";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  clientName: string;
  counselorName: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  consultationFormat: string;
}) {
  const client = getClient();
  if (!client) {
    console.warn("RESEND_API_KEY not set; skipping confirmation email");
    return { ok: false, skipped: true };
  }

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const dateLabel = thaiDateLabel(params.dateKey);

  try {
    const result = await client.emails.send({
      from: `ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต <${from}>`,
      to: params.to,
      subject: "ยืนยันการจองคิวรับคำปรึกษา",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
          <h2 style="color: #2563eb;">ยืนยันการจองคิวรับคำปรึกษา ✅</h2>
          <p>เรียน คุณ${escapeHtml(params.clientName)}</p>
          <p>การจองคิวรับคำปรึกษาของคุณได้รับการยืนยันแล้ว รายละเอียดมีดังนี้</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">ผู้ให้คำปรึกษา</td>
              <td style="padding: 6px 0;">${escapeHtml(params.counselorName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">วันที่</td>
              <td style="padding: 6px 0;">${escapeHtml(dateLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">เวลา</td>
              <td style="padding: 6px 0;">${escapeHtml(params.startTime)} - ${escapeHtml(params.endTime)} น.</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">รูปแบบ</td>
              <td style="padding: 6px 0;">${escapeHtml(params.consultationFormat)}</td>
            </tr>
          </table>
          <p>หากต้องการเปลี่ยนแปลงหรือยกเลิกการนัดหมาย กรุณาติดต่อศูนย์ให้คำปรึกษาโดยตรง</p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
            ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต
          </p>
        </div>
      `,
    });
    if (result.error) {
      console.error("Failed to send confirmation email", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to send confirmation email", err);
    return { ok: false, error: err };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
