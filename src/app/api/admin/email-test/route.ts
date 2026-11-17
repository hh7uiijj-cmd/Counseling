import { NextResponse } from "next/server";
import { adminNotifyEmail, isEmailConfigured, sendAdminNotificationEmail } from "@/lib/email";

/** Send a test email to the admin notification address. */
export async function POST() {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "ยังไม่ได้ตั้งค่า RESEND_API_KEY ใน Vercel" },
      { status: 400 }
    );
  }
  const result = await sendAdminNotificationEmail({
    subject: "ทดสอบอีเมลแจ้งเตือน",
    lines: ["นี่คืออีเมลทดสอบจากระบบจองคิวโครงการเพื่อนวัยใส", "ถ้าเห็นอีเมลนี้ แปลว่าระบบส่งแจ้งเตือนทางอีเมลได้"],
    link: "/admin/announce",
  });
  if (!result.ok) {
    const detail = "error" in result && result.error ? JSON.stringify(result.error) : "";
    return NextResponse.json(
      {
        error: "email_error",
        message: `ส่งอีเมลไม่สำเร็จ${detail ? ` · ${detail.slice(0, 300)}` : ""}`,
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, to: adminNotifyEmail() });
}
