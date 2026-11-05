import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey } from "@/lib/dates";
import { slotIsActive } from "@/lib/counselors";
import { BookingStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/**
 * Every day from today onward that has at least one shift (or is a closed day), with how many
 * bookable (2 counselors signed up, not yet booked) shifts it has. Drives the Friday list on the
 * booking page, so it reaches as far ahead as shifts have been created.
 */
export async function GET() {
  const from = dateOnly(toDateKey(new Date()));

  const [slots, closedDates] = await Promise.all([
    prisma.slot.findMany({
      where: { date: { gte: from } },
      include: {
        counselor: { select: { id: true, name: true, active: true } },
        partner: { select: { id: true, name: true, active: true } },
        booking: { select: { status: true } },
      },
    }),
    prisma.closedDate.findMany({ where: { date: { gte: from } } }),
  ]);

  type Day = { date: string; totalSlots: number; activeSlots: number; availableSlots: number; closed: boolean };
  const days = new Map<string, Day>();
  const get = (key: string) => {
    if (!days.has(key)) days.set(key, { date: key, totalSlots: 0, activeSlots: 0, availableSlots: 0, closed: false });
    return days.get(key)!;
  };

  for (const slot of slots) {
    const day = get(toDateKey(slot.date));
    day.totalSlots += 1;
    if (!slotIsActive(slot)) continue;
    day.activeSlots += 1;
    if (!slot.booking || slot.booking.status === BookingStatus.CANCELLED) day.availableSlots += 1;
  }
  for (const c of closedDates) get(toDateKey(c.date)).closed = true;

  return NextResponse.json({
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  });
}
