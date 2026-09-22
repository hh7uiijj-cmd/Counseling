import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toTimeKey } from "@/lib/dates";
import { BookingStatus } from "@/generated/prisma/enums";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const closedDate = await prisma.closedDate.findUnique({
    where: { date: dateOnly(date) },
  });

  const slots = await prisma.slot.findMany({
    where: {
      date: dateOnly(date),
      counselor: { active: true },
    },
    include: {
      counselor: { select: { id: true, name: true, title: true, color: true } },
      booking: { select: { status: true } },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  const items = slots.map((slot) => ({
    id: slot.id,
    counselorId: slot.counselor.id,
    counselorName: slot.counselor.name,
    counselorTitle: slot.counselor.title,
    counselorColor: slot.counselor.color,
    startTime: toTimeKey(slot.startsAt),
    endTime: toTimeKey(slot.endsAt),
    available:
      closedDate == null &&
      (!slot.booking || slot.booking.status === BookingStatus.CANCELLED),
  }));

  return NextResponse.json({
    date,
    closed: Boolean(closedDate),
    closedReason: closedDate?.reason ?? null,
    slots: items,
  });
}
