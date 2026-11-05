import { NextResponse } from "next/server";
import { isLineConfigured, pushMessageToGroup } from "@/lib/line";
import { thaiDateLabel } from "@/lib/dates";

/** Send sample "someone signed up for a shift" messages to the LINE group. Writes nothing to the database. */
export async function POST() {
  if (!isLineConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID" },
      { status: 400 }
    );
  }

  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const p = (n: number) => String(n).padStart(2, "0");
  const when = `${thaiDateLabel(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} 09:00-10:00 น.`;

  const result = await pushMessageToGroup([
    { type: "text", text: `🧪 [ทดสอบ] ดาวเหนือ ลงเวร ${when} รออีก 1 คน` },
    {
      type: "text",
      text: `🧪 [ทดสอบ] เวรครบ 2 คนแล้ว ✅ ${when} (ดาวเหนือ + ดาวใต้) เปิดให้จองคิวได้แล้ว`,
    },
  ]);
  if (!result.ok) {
    return NextResponse.json(
      { error: "line_api_error", message: "ส่งไม่สำเร็จ กรุณาตรวจสอบ LINE_GROUP_ID และ token", detail: result },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
