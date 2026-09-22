import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toDateKey, toTimeKey } from "@/lib/dates";
import { buildBookingFlexMessage, pushMessageToGroup } from "@/lib/line";
import { BookingStatus } from "@/generated/prisma/enums";

const createSchema = z.object({
  slotId: z.string().min(1),
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().min(6).max(30),
  clientEmail: z.string().email().optional().or(z.literal("")),
  topic: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { slotId, clientName, clientPhone, clientEmail, topic, note } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
      include: { booking: true, counselor: true },
    });

    if (!slot || !slot.counselor.active) {
      return { error: "slot_not_found" as const };
    }

    const closedDate = await tx.closedDate.findUnique({
      where: { date: slot.date },
    });
    if (closedDate) {
      return { error: "date_closed" as const };
    }

    if (slot.booking && slot.booking.status !== BookingStatus.CANCELLED) {
      return { error: "slot_taken" as const };
    }

    const data = {
      clientName,
      clientPhone,
      clientEmail: clientEmail || null,
      topic: topic || null,
      note: note || null,
      status: BookingStatus.PENDING,
    };

    const booking = slot.booking
      ? await tx.booking.update({ where: { id: slot.booking.id }, data })
      : await tx.booking.create({ data: { ...data, slotId: slot.id } });

    return { booking, slot };
  });

  if ("error" in result) {
    const status = result.error === "slot_not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  const { booking, slot } = result;

  try {
    const dateKey = toDateKey(slot.date);
    const message = buildBookingFlexMessage({
      bookingId: booking.id,
      counselorName: slot.counselor.name,
      clientName: booking.clientName,
      clientPhone: booking.clientPhone,
      topic: booking.topic,
      dateKey,
      startTime: toTimeKey(slot.startsAt),
      endTime: toTimeKey(slot.endsAt),
    });
    const pushResult = await pushMessageToGroup([message]);
    if (pushResult.ok) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { lineNotified: true },
      });
    }
  } catch (err) {
    console.error("Failed to send LINE notification", err);
  }

  return NextResponse.json({ booking }, { status: 201 });
}
