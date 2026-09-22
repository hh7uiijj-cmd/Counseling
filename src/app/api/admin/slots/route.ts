import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bangkokDateTime, dateOnly, toDateKey } from "@/lib/dates";

const bulkCreateSchema = z
  .object({
    counselorId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    slotDurationMinutes: z.number().int().min(5).max(24 * 60).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["endDate"],
  });

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const counselorId = searchParams.get("counselorId") ?? undefined;

  const where: Record<string, unknown> = {};
  if (counselorId) where.counselorId = counselorId;
  if (from || to) {
    where.date = {
      ...(from ? { gte: dateOnly(from) } : {}),
      ...(to ? { lte: dateOnly(to) } : {}),
    };
  }

  const slots = await prisma.slot.findMany({
    where,
    include: {
      counselor: true,
      booking: true,
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({ slots });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const {
    counselorId,
    startDate,
    endDate,
    daysOfWeek,
    startTime,
    endTime,
    slotDurationMinutes,
  } = parsed.data;

  const counselor = await prisma.counselor.findUnique({ where: { id: counselorId } });
  if (!counselor) {
    return NextResponse.json({ error: "counselor_not_found" }, { status: 404 });
  }

  const closedDates = await prisma.closedDate.findMany({
    where: {
      date: {
        gte: dateOnly(startDate),
        lte: dateOnly(endDate),
      },
    },
  });
  const closedSet = new Set(closedDates.map((c) => toDateKey(c.date)));

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const dayStartMinutes = startH * 60 + startM;
  const dayEndMinutes = endH * 60 + endM;
  const duration = slotDurationMinutes ?? dayEndMinutes - dayStartMinutes;

  const toCreate: {
    counselorId: string;
    date: Date;
    startsAt: Date;
    endsAt: Date;
  }[] = [];

  const cursor = dateOnly(startDate);
  const end = dateOnly(endDate);

  while (cursor.getTime() <= end.getTime()) {
    const dateKey = toDateKey(cursor);
    const dow = new Date(dateKey + "T00:00:00Z").getUTCDay();
    const includeDay = !daysOfWeek || daysOfWeek.includes(dow);

    if (includeDay && !closedSet.has(dateKey)) {
      for (
        let minutes = dayStartMinutes;
        minutes + duration <= dayEndMinutes;
        minutes += duration
      ) {
        const startHH = String(Math.floor(minutes / 60)).padStart(2, "0");
        const startMM = String(minutes % 60).padStart(2, "0");
        const slotEndMinutes = minutes + duration;
        const endHH = String(Math.floor(slotEndMinutes / 60)).padStart(2, "0");
        const endMM = String(slotEndMinutes % 60).padStart(2, "0");

        toCreate.push({
          counselorId,
          date: dateOnly(dateKey),
          startsAt: bangkokDateTime(dateKey, `${startHH}:${startMM}`),
          endsAt: bangkokDateTime(dateKey, `${endHH}:${endMM}`),
        });
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (toCreate.length === 0) {
    return NextResponse.json(
      { error: "nothing_to_create", message: "ไม่มีคิวที่จะสร้างในช่วงเวลาที่เลือก" },
      { status: 400 }
    );
  }

  const result = await prisma.slot.createMany({ data: toCreate });

  return NextResponse.json({ created: result.count }, { status: 201 });
}
