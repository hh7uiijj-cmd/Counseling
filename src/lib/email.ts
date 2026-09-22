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
  studentId?: string | null;
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

  const fromAddress = (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();
  const from = `SDU Counseling Center <${fromAddress}>`;
  const to = params.to.trim();
  const baseUrl = process.env.APP_BASE_URL;
  const hasValidBaseUrl = Boolean(baseUrl && /^https?:\/\//.test(baseUrl));
  const logoUrl = hasValidBaseUrl ? `${baseUrl}/brand/logo.png` : null;
  const dateTimeLabel = `${thaiDateLabel(params.dateKey)} เวลา ${params.startTime} - ${params.endTime} น.`;

  console.log(
    `Sending confirmation email: from="${from}" (${from.length} chars), to="${to}" (${to.length} chars)`
  );

  try {
    const result = await client.emails.send({
      from,
      to,
      subject: "ยืนยันการจองคิวรับคำปรึกษา",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
          ${
            logoUrl
              ? `<div style="text-align: center; margin-bottom: 16px;">
                   <img src="${logoUrl}" alt="ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต" style="width: 96px; height: 96px;" />
                 </div>`
              : ""
          }
          <h2 style="color: #2563eb; text-align: center;">ยืนยันการจองคิวรับคำปรึกษา ✅</h2>
          <p style="line-height: 1.8;">
            สวัสดีคุณ${escapeHtml(params.clientName)}
            ${params.studentId ? ` รหัสนักศึกษา ${escapeHtml(params.studentId)}` : ""}
            ขณะนี้ทาง ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต ได้รับการนัดหมายและยืนยันการเข้ารับคำปรึกษาในรูปแบบ
            ${escapeHtml(params.consultationFormat)} ใน ${escapeHtml(dateTimeLabel)} แล้ว
          </p>
          <p style="line-height: 1.8;">
            หากเกิดปัญหาหรือแจ้งเปลี่ยนข้อมูลสามารถติดต่อได้ผ่านเบอร์โทรศัพท์ 0-2244-5006
            ตั้งแต่ วันจันทร์ - วันศุกร์ ตั้งแต่เวลา 8:30 - 15:30 น.
          </p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 13px; text-align: center;">
            ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต
          </p>
        </div>
      `,
    });
    if (result.error) {
      console.error("Failed to send confirmation email", JSON.stringify(result.error));
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to send confirmation email", err instanceof Error ? err.message : JSON.stringify(err));
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
