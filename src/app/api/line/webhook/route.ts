import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey, toTimeKey } from "@/lib/dates";
import {
  buildScheduleFlexMessage,
  replyMessage,
  verifyLineSignature,
} from "@/lib/line";
import { updateBookingStatus } from "@/lib/bookingActions";
import { BookingStatus } from "@/generated/prisma/enums";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอการยืนยัน",
  CONFIRMED: "ยืนยันแล้ว ✅",
  CANCELLED: "ยกเลิกแล้ว ❌",
  COMPLETED: "เสร็จสิ้น",
};

async function handleBookingPostback(data: string, replyToken: string) {
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const bookingId = params.get("bookingId");
  if (!bookingId || (action !== "confirm" && action !== "cancel")) return;

  const targetStatus = action === "confirm" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { include: { counselor: true } } },
  });

  if (!booking) {
    await replyMessage(replyToken, [
      { type: "text", text: "ไม่พบข้อมูลการจองนี้ อาจถูกลบไปแล้ว" },
    ]);
    return;
  }

  if (booking.status === targetStatus) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text: `การจองของ ${booking.clientName} ถูก${STATUS_LABELS[targetStatus]}อยู่แล้ว`,
      },
    ]);
    return;
  }

  const updated = await updateBookingStatus(bookingId, targetStatus);

  await replyMessage(replyToken, [
    {
      type: "text",
      text: `อัปเดตสถานะการจองของ ${updated.clientName} เป็น "${STATUS_LABELS[targetStatus]}" เรียบร้อยแล้ว`,
    },
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineEvent = any;

function resolveDateKeyFromText(text: string): string | null {
  const trimmed = text.trim();
  const now = new Date();
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  if (["ปฏิทิน", "ตารางวันนี้", "today", "วันนี้"].includes(trimmed)) {
    return todayKey;
  }
  if (["ตารางพรุ่งนี้", "tomorrow", "พรุ่งนี้"].includes(trimmed)) {
    return tomorrowKey;
  }
  const match = trimmed.match(/^ตาราง\s*(\d{4}-\d{2}-\d{2})$/);
  if (match) return match[1];
  return null;
}

async function handleScheduleRequest(dateKey: string, replyToken: string) {
  const slots = await prisma.slot.findMany({
    where: {
      date: dateOnly(dateKey),
      counselor: { active: true },
    },
    include: {
      counselor: { select: { name: true, color: true } },
      booking: { select: { status: true, clientName: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const items = slots.map((slot) => ({
    counselorName: slot.counselor.name,
    counselorColor: slot.counselor.color,
    startTime: toTimeKey(slot.startsAt),
    endTime: toTimeKey(slot.endsAt),
    status: (!slot.booking || slot.booking.status === BookingStatus.CANCELLED
      ? "available"
      : "booked") as "available" | "booked",
    clientName: slot.booking?.clientName,
  }));

  const message = buildScheduleFlexMessage({ dateKey, items });
  await replyMessage(replyToken, [message]);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  await Promise.all(
    (body.events || []).map(async (event) => {
      // Log the source id/type for every event so it can be found in deploy
      // logs even without a text command (e.g. joins, non-text messages).
      console.log("LINE event source:", JSON.stringify(event.source));

      if (event.type === "postback") {
        try {
          await handleBookingPostback(event.postback.data as string, event.replyToken);
        } catch (err) {
          console.error("Failed to handle LINE postback", err);
        }
        return;
      }

      if (event.type !== "message" || event.message?.type !== "text") return;
      const text = (event.message.text as string).trim();

      if (["รหัสกลุ่ม", "groupid", "group id", "รหัสห้อง", "id"].includes(text.toLowerCase())) {
        const sourceType = event.source?.type;
        const sourceId =
          event.source?.groupId || event.source?.roomId || event.source?.userId || "ไม่พบ";
        try {
          await replyMessage(event.replyToken, [
            {
              type: "text",
              text: `ประเภท: ${sourceType}\nID: ${sourceId}\n\nนำ ID นี้ไปใส่ในตัวแปร LINE_GROUP_ID`,
            },
          ]);
        } catch (err) {
          console.error("Failed to reply with group id", err);
        }
        return;
      }

      const dateKey = resolveDateKeyFromText(text);
      if (!dateKey) return;
      try {
        await handleScheduleRequest(dateKey, event.replyToken);
      } catch (err) {
        console.error("Failed to reply to LINE schedule request", err);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
