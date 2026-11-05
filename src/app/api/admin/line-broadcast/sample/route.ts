import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildBookingFlexMessage,
  buildCounselorMentionMessage,
  buildSignupFlexMessage,
  buildStatusUpdateMessage,
  isLineConfigured,
  pushMessageToGroup,
} from "@/lib/line";
import { thaiDateLabel } from "@/lib/dates";

const SAMPLE_KINDS = [
  "signup-card",
  "shift-signup",
  "shift-full",
  "shift-cancel",
  "swap-request",
  "swap-accepted",
  "swap-declined",
  "booking-new",
  "booking-confirmed",
  "booking-cancelled",
] as const;

const schema = z.object({ kind: z.enum(SAMPLE_KINDS) });

function nextFridayKey() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Post a SAMPLE of each automatic LINE message to the group so the admin can see what it looks like.
 * Writes nothing to the database; buttons on the sample booking card point at a fake booking id.
 */
export async function POST(request: NextRequest) {
  if (!isLineConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", message: "ไม่รู้จักประเภทข้อความทดสอบ" }, { status: 400 });
  }

  const dateKey = nextFridayKey();
  const when = `${thaiDateLabel(dateKey)} 09:00-10:00 น.`;
  const when2 = `${thaiDateLabel(dateKey)} 10:00-11:00 น.`;
  const T = "🧪 [ทดสอบ] ";

  let messages: Record<string, unknown>[];
  switch (parsed.data.kind) {
    case "signup-card": {
      const liffId = process.env.LIFF_ID;
      if (!liffId) {
        return NextResponse.json({ error: "no_liff", message: "ยังไม่ได้ตั้งค่า LIFF_ID ใน Vercel" }, { status: 400 });
      }
      messages = [buildSignupFlexMessage({ signupUrl: `https://liff.line.me/${liffId}`, note: "(ข้อความทดสอบ)" })];
      break;
    }
    case "shift-signup":
      messages = [{ type: "text", text: `${T}ดาวเหนือ ลงเวร ${when} รออีก 1 คน` }];
      break;
    case "shift-full":
      messages = [{ type: "text", text: `${T}เวรครบ 2 คนแล้ว ✅ ${when} (ดาวเหนือ + ดาวใต้) เปิดให้จองคิวได้แล้ว` }];
      break;
    case "shift-cancel":
      messages = [
        { type: "text", text: `${T}ดาวเหนือ ยกเลิกเวร ❌ ${when} ตอนนี้เหลือ ดาวใต้ รออีก 1 คน` },
      ];
      break;
    case "swap-request":
      messages = [
        {
          type: "text",
          text: `${T}คำขอสลับเวร 🔁 ดาวเหนือ (เวร ${when}) ขอสลับกับเวร ${when2} ของคุณ กรุณาเปิดหน้าลงเวรเพื่อกดยอมรับหรือปฏิเสธ`,
        },
      ];
      break;
    case "swap-accepted":
      messages = [{ type: "text", text: `${T}สลับเวรสำเร็จ ✅ ดาวเหนือ ↔ ดาวใต้ (${when} ↔ ${when2})` }];
      break;
    case "swap-declined":
      messages = [{ type: "text", text: `${T}ดาวใต้ ปฏิเสธคำขอสลับเวร ${when} ↔ ${when2} ❌` }];
      break;
    case "booking-new":
      messages = [
        buildCounselorMentionMessage([]),
        buildBookingFlexMessage({
          bookingId: "test-not-a-real-booking",
          counselorName: "ดาวเหนือ + ดาวใต้",
          clientName: "ทดสอบ ระบบ",
          studentId: "000000000000",
          faculty: "คณะมนุษยศาสตร์และสังคมศาสตร์",
          major: "จิตวิทยาอุตสาหกรรมและองค์การ",
          clientPhone: "0800000000",
          lineId: "test-line-id",
          consultationFormat: "On Site: ห้อง SDU Counseling Center",
          topic: "ข้อความทดสอบ (ไม่ใช่การจองจริง)",
          dateKey,
          startTime: "09:00",
          endTime: "10:00",
        }),
      ];
      break;
    case "booking-confirmed":
    case "booking-cancelled":
      messages = [
        buildStatusUpdateMessage({
          clientName: "ทดสอบ ระบบ",
          counselorName: "ดาวเหนือ + ดาวใต้",
          dateKey,
          startTime: "09:00",
          endTime: "10:00",
          status: parsed.data.kind === "booking-confirmed" ? "CONFIRMED" : "CANCELLED",
        }),
      ];
      break;
  }

  const result = await pushMessageToGroup(messages);
  if (!result.ok) {
    return NextResponse.json(
      { error: "line_api_error", message: "ส่งไม่สำเร็จ กรุณาตรวจสอบ LINE_GROUP_ID และ token", detail: result },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
