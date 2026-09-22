import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import { toDateKey, toTimeKey } from "@/lib/dates";
import { buildStatusUpdateMessage, pushMessageToGroup } from "@/lib/line";

const updateSchema = z
  .object({
    status: z
      .enum([
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.COMPLETED,
      ])
      .optional(),
    newSlotId: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== undefined || data.newSlotId !== undefined, {
    message: "ต้องระบุ status หรือ newSlotId อย่างน้อยหนึ่งอย่าง",
  });

type BookingWithSlot = {
  clientName: string;
  slot: {
    date: Date;
    startsAt: Date;
    endsAt: Date;
    counselor: { name: string };
  };
};

async function notifyStatusChange(booking: BookingWithSlot, status: BookingStatus) {
  try {
    const message = buildStatusUpdateMessage({
      clientName: booking.clientName,
      counselorName: booking.slot.counselor.name,
      dateKey: toDateKey(booking.slot.date),
      startTime: toTimeKey(booking.slot.startsAt),
      endTime: toTimeKey(booking.slot.endsAt),
      status,
    });
    await pushMessageToGroup([message]);
  } catch (err) {
    console.error("Failed to send LINE status update", err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { status, newSlotId } = parsed.data;

  if (!newSlotId) {
    const booking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: { slot: { include: { counselor: true } } },
    });
    if (status) await notifyStatusChange(booking, status);
    return NextResponse.json({ booking });
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentBooking = await tx.booking.findUnique({ where: { id } });
    if (!currentBooking) {
      return { error: "booking_not_found" as const };
    }

    const newSlot = await tx.slot.findUnique({
      where: { id: newSlotId },
      include: { booking: true, counselor: true },
    });
    if (!newSlot || !newSlot.counselor.active) {
      return { error: "slot_not_found" as const };
    }
    if (
      newSlot.booking &&
      newSlot.booking.id !== currentBooking.id &&
      newSlot.booking.status !== BookingStatus.CANCELLED
    ) {
      return { error: "slot_taken" as const };
    }

    const closedDate = await tx.closedDate.findUnique({ where: { date: newSlot.date } });
    if (closedDate) {
      return { error: "date_closed" as const };
    }

    // If another (cancelled) booking already occupies the target slot, remove it
    // so the unique slotId constraint doesn't block moving this booking there.
    if (newSlot.booking && newSlot.booking.id !== currentBooking.id) {
      await tx.booking.delete({ where: { id: newSlot.booking.id } });
    }

    const booking = await tx.booking.update({
      where: { id },
      data: { slotId: newSlotId, ...(status ? { status } : {}) },
      include: { slot: { include: { counselor: true } } },
    });

    return { booking };
  });

  if ("error" in result) {
    const statusCode = result.error === "booking_not_found" || result.error === "slot_not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  if (status) await notifyStatusChange(result.booking, status);

  return NextResponse.json({ booking: result.booking });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
