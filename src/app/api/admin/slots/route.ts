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
  if (counselorId) where.OR = [{ counselorId }, { partnerId: counselorId }];
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
      partner: true,
      booking: true,
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({ slots });
}

const rotationSchema = z
  .object({
    mode: z.enum(["rotation", "open"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    windows: z
      .array(
        z.object({
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/),
        })
      )
      .min(1),
    slotDurationMinutes: z.number().int().min(5).max(24 * 60),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["endDate"],
  });

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Fill every hour of every chosen weekday with shifts.
 * - "rotation": assign the next fixed pair to each hour, cycling through all pairs.
 * - "open": create unassigned shifts that pairs claim themselves from the LIFF page.
 */
async function createRotation(body: unknown) {
  const parsed = rotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  const { mode, startDate, endDate, daysOfWeek, windows, slotDurationMinutes: duration } = parsed.data;

  const counselors = await prisma.counselor.findMany({
    where: { active: true, partnerId: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  const byId = new Map(counselors.map((c) => [c.id, c]));
  const pairs = counselors.flatMap((c) => {
    const partner = c.partnerId ? byId.get(c.partnerId) : undefined;
    // Take each pair once, from whichever member was created first.
    return partner && c.id < partner.id ? [{ a: c, b: partner }] : [];
  });
  pairs.sort((x, y) => x.a.createdAt.getTime() - y.a.createdAt.getTime());

  if (mode === "rotation" && pairs.length === 0) {
    return NextResponse.json(
      { error: "no_pairs", message: "ยังไม่มีคู่ผู้ให้คำปรึกษา กรุณาจับคู่ในหน้า 'ผู้ให้คำปรึกษา' ก่อน" },
      { status: 400 }
    );
  }

  const [closedDates, existing] = await Promise.all([
    prisma.closedDate.findMany({
      where: { date: { gte: dateOnly(startDate), lte: dateOnly(endDate) } },
    }),
    prisma.slot.findMany({
      where: { date: { gte: dateOnly(startDate), lte: dateOnly(endDate) } },
      select: { startsAt: true },
    }),
  ]);
  const closedSet = new Set(closedDates.map((c) => toDateKey(c.date)));
  const takenStarts = new Set(existing.map((s) => s.startsAt.getTime()));

  const toCreate: {
    counselorId: string | null;
    partnerId: string | null;
    date: Date;
    startsAt: Date;
    endsAt: Date;
  }[] = [];
  let next = 0;

  const cursor = dateOnly(startDate);
  const end = dateOnly(endDate);
  while (cursor.getTime() <= end.getTime()) {
    const dateKey = toDateKey(cursor);
    const dow = new Date(dateKey + "T00:00:00Z").getUTCDay();
    if (daysOfWeek.includes(dow) && !closedSet.has(dateKey)) {
      for (const w of windows) {
        const [sh, sm] = w.startTime.split(":").map(Number);
        const [eh, em] = w.endTime.split(":").map(Number);
        const from = sh * 60 + sm;
        const to = eh * 60 + em;
        for (let m = from; m + duration <= to; m += duration) {
          const startsAt = bangkokDateTime(dateKey, `${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
          const e = m + duration;
          const endsAt = bangkokDateTime(dateKey, `${pad(Math.floor(e / 60))}:${pad(e % 60)}`);
          if (takenStarts.has(startsAt.getTime())) continue;
          const pair = mode === "rotation" ? pairs[next % pairs.length] : null;
          next += 1;
          toCreate.push({
            counselorId: pair ? pair.a.id : null,
            partnerId: pair ? pair.b.id : null,
            date: dateOnly(dateKey),
            startsAt,
            endsAt,
          });
        }
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
  return NextResponse.json(
    { created: result.count, pairs: mode === "rotation" ? pairs.length : 0 },
    { status: 201 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const mode = body && typeof body === "object" ? (body as { mode?: unknown }).mode : undefined;
  if (mode === "rotation" || mode === "open") {
    return createRotation(body);
  }
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
    partnerId: string | null;
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
          partnerId: counselor.partnerId,
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

const bulkDeleteSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("counselor"), counselorId: z.string().min(1) }),
  z.object({ scope: z.literal("date"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);

/**
 * Bulk-delete slots: everything upcoming, everything one counselor sits in, or one whole day.
 * Slots whose booking is not cancelled are kept (never lose a real booking or its history).
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const input = parsed.data;

  const today = dateOnly(toDateKey(new Date()));
  const where: Record<string, unknown> =
    input.scope === "date"
      ? { date: dateOnly(input.date) }
      : input.scope === "counselor"
        ? { date: { gte: today }, OR: [{ counselorId: input.counselorId }, { partnerId: input.counselorId }] }
        : { date: { gte: today } };

  const total = await prisma.slot.count({ where });
  const deleted = await prisma.slot.deleteMany({
    where: {
      ...where,
      // Keep any slot whose booking is not cancelled.
      AND: [{ OR: [{ booking: { is: null } }, { booking: { is: { status: "CANCELLED" } } }] }],
    },
  });

  return NextResponse.json({ deleted: deleted.count, skipped: total - deleted.count });
}
