import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey, toTimeKey } from "@/lib/dates";
import {
  buildBookingCarouselMessage,
  buildMentionTextMessage,
  buildScheduleFlexMessage,
  buildSignupFlexMessage,
  replyMessage,
  verifyLineSignature,
} from "@/lib/line";
import { bookingCardParams } from "@/lib/bookingMessages";
import { slotCounselorLabel, slotIsActive, slotMembers } from "@/lib/counselors";
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

  const targetStatus =
    action === "confirm" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { include: { counselor: true, partner: true } } },
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
      counselor: { select: { name: true, color: true, active: true } },
      partner: { select: { name: true, active: true } },
      booking: { select: { status: true, clientName: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const items = slots.flatMap((slot) =>
    !slot.counselor || !slotIsActive(slot)
      ? []
      : [
          {
            counselorName: slotCounselorLabel(slot),
            counselorColor: slot.counselor.color,
            startTime: toTimeKey(slot.startsAt),
            endTime: toTimeKey(slot.endsAt),
            status: (!slot.booking ||
            slot.booking.status === BookingStatus.CANCELLED
              ? "available"
              : "booked") as "available" | "booked",
            clientName: slot.booking?.clientName,
          },
        ],
  );

  const message = buildScheduleFlexMessage({ dateKey, items });
  await replyMessage(replyToken, [message]);
}

/** "ลงเวร": reply with the sign-up card (free, unlike a push). */
async function handleSignupRequest(replyToken: string) {
  const liffId = process.env.LIFF_ID;
  if (!liffId) {
    await replyMessage(replyToken, [
      { type: "text", text: "ยังไม่ได้ตั้งค่าหน้าลงเวร (LIFF_ID) กรุณาแจ้งแอดมิน" },
    ]);
    return;
  }
  await replyMessage(replyToken, [
    buildSignupFlexMessage({ signupUrl: `https://liff.line.me/${liffId}` }),
  ]);
}

/** "คิวใหม่": reply with every upcoming booking still waiting for confirmation, tagging its counselors. */
async function handlePendingBookingsRequest(replyToken: string) {
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      slot: { date: { gte: dateOnly(toDateKey(new Date())) } },
    },
    include: { slot: { include: { counselor: true, partner: true } } },
    orderBy: [{ slot: { startsAt: "asc" } }],
  });

  if (bookings.length === 0) {
    await replyMessage(replyToken, [
      { type: "text", text: "ไม่มีคิวที่รอยืนยัน 🎉" },
    ]);
    return;
  }

  const shown = bookings.slice(0, 12);
  const people = new Map<string, { name: string; lineUserId: string }>();
  for (const b of shown) {
    for (const m of slotMembers(b.slot)) {
      if (m.lineUserId) people.set(m.lineUserId, { name: m.name, lineUserId: m.lineUserId });
    }
  }
  const extra = bookings.length - shown.length;
  const summary =
    `มีคิวรอยืนยัน ${bookings.length} คิว กรุณาตรวจสอบและกดยืนยัน 🔔` +
    (extra > 0 ? `\n(แสดง ${shown.length} คิวแรก ดูทั้งหมดที่หน้าแอดมิน)` : "");

  await replyMessage(replyToken, [
    buildMentionTextMessage([...people.values()].slice(0, 20), summary),
    buildBookingCarouselMessage(shown.map((b) => bookingCardParams(b, b.slot))),
  ]);
}

/** "ลงทะเบียน <ชื่อ>" in the group links the sender's LINE user ID to the counselor with that name. */
async function handleRegister(
  name: string,
  userId: string | undefined,
  replyToken: string,
) {
  if (!userId) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text: "ไม่พบ LINE User ID ของคุณ กรุณาเพิ่มบอทเป็นเพื่อนก่อนแล้วลองอีกครั้ง",
      },
    ]);
    return;
  }

  const matches = await prisma.counselor.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (matches.length !== 1) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text:
          matches.length === 0
            ? `ไม่พบผู้ให้คำปรึกษาชื่อ "${name}" กรุณาพิมพ์ชื่อให้ตรงกับที่แอดมินบันทึกไว้`
            : `พบชื่อ "${name}" ซ้ำกันหลายคน กรุณาแจ้งแอดมินให้ผูกบัญชีให้`,
      },
    ]);
    return;
  }

  const counselor = matches[0];
  if (counselor.lineUserId && counselor.lineUserId !== userId) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text: `"${counselor.name}" ผูกบัญชี LINE ไว้แล้ว หากต้องการเปลี่ยนกรุณาแจ้งแอดมิน`,
      },
    ]);
    return;
  }

  await prisma.counselor.update({
    where: { id: counselor.id },
    data: { lineUserId: userId },
  });
  await replyMessage(replyToken, [
    {
      type: "text",
      text: `ผูกบัญชี LINE ของคุณกับ "${counselor.name}" เรียบร้อยแล้ว ✅ ต่อไปบอทจะแท็กชื่อคุณเมื่อมีคิวใหม่`,
    },
  ]);
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
          await handleBookingPostback(
            event.postback.data as string,
            event.replyToken,
          );
        } catch (err) {
          console.error("Failed to handle LINE postback", err);
        }
        return;
      }

      if (event.type !== "message" || event.message?.type !== "text") return;
      const text = (event.message.text as string).trim();

      if (
        ["รหัสกลุ่ม", "groupid", "group id", "รหัสห้อง", "id"].includes(
          text.toLowerCase(),
        )
      ) {
        const sourceType = event.source?.type;
        const sourceId =
          event.source?.groupId ||
          event.source?.roomId ||
          event.source?.userId ||
          "ไม่พบ";
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

      if (["ไอดีของฉัน", "my id", "myid"].includes(text.toLowerCase())) {
        const userId =
          event.source?.userId ||
          "ไม่พบ (ต้องเป็นสมาชิกที่เพิ่มบอทเป็นเพื่อนแล้ว)";
        try {
          await replyMessage(event.replyToken, [
            {
              type: "text",
              text: `LINE User ID ของคุณ:\n${userId}\n\nนำ ID นี้ไปให้แอดมินใส่ในระบบ เพื่อให้บอทแท็กชื่อคุณเวลามีคิวใหม่`,
            },
          ]);
        } catch (err) {
          console.error("Failed to reply with user id", err);
        }
        return;
      }

      if (text === "ลงเวร") {
        try {
          await handleSignupRequest(event.replyToken);
        } catch (err) {
          console.error("Failed to reply with sign-up card", err);
        }
        return;
      }

      if (["คิวใหม่", "คิวที่รอ", "คิวรอยืนยัน"].includes(text)) {
        try {
          await handlePendingBookingsRequest(event.replyToken);
        } catch (err) {
          console.error("Failed to reply with pending bookings", err);
        }
        return;
      }

      const registerMatch = text.match(/^ลงทะเบียน\s+(.+)$/);
      if (registerMatch) {
        try {
          await handleRegister(
            registerMatch[1].trim(),
            event.source?.userId as string | undefined,
            event.replyToken,
          );
        } catch (err) {
          console.error("Failed to handle LINE register", err);
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
    }),
  );

  return NextResponse.json({ ok: true });
}
