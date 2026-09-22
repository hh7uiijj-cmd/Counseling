import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey } from "@/lib/dates";
import { BookingStatus } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const [year, monthNum] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

  const rangeStart = dateOnly(startDate);
  const rangeEnd = dateOnly(endDate);

  const [slots, closedDates] = await Promise.all([
    prisma.slot.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      include: {
        counselor: { select: { id: true, name: true, color: true, active: true } },
        booking: { select: { status: true } },
      },
    }),
    prisma.closedDate.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  const closedSet = new Set(closedDates.map((c) => toDateKey(c.date)));

  type DaySummary = {
    date: string;
    totalSlots: number;
    availableSlots: number;
    counselorNames: string[];
    closed: boolean;
  };

  const days = new Map<string, DaySummary>();

  for (const slot of slots) {
    if (!slot.counselor.active) continue;
    const key = toDateKey(slot.date);
    const isAvailable =
      !slot.booking || slot.booking.status === BookingStatus.CANCELLED;

    if (!days.has(key)) {
      days.set(key, {
        date: key,
        totalSlots: 0,
        availableSlots: 0,
        counselorNames: [],
        closed: closedSet.has(key),
      });
    }
    const day = days.get(key)!;
    day.totalSlots += 1;
    if (isAvailable) {
      day.availableSlots += 1;
      if (!day.counselorNames.includes(slot.counselor.name)) {
        day.counselorNames.push(slot.counselor.name);
      }
    }
  }

  for (const dateKey of closedSet) {
    if (!days.has(dateKey)) {
      days.set(dateKey, {
        date: dateKey,
        totalSlots: 0,
        availableSlots: 0,
        counselorNames: [],
        closed: true,
      });
    }
  }

  return NextResponse.json({ days: Array.from(days.values()) });
}
