import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bangkokDateTime, toDateKey, toTimeKey } from "@/lib/dates";
import {
  buildScheduleFlexMessage,
  replyMessage,
  verifyLineSignature,
} from "@/lib/line";
import { BookingStatus } from "@/generated/prisma/enums";

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
      date: bangkokDateTime(dateKey, "00:00"),
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
      if (event.type !== "message" || event.message?.type !== "text") return;
      const dateKey = resolveDateKeyFromText(event.message.text as string);
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
