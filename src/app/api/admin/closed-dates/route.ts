import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/lib/dates";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export async function GET() {
  const closedDates = await prisma.closedDate.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ closedDates });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const closedDate = await prisma.closedDate.upsert({
    where: { date: dateOnly(parsed.data.date) },
    update: { reason: parsed.data.reason },
    create: {
      date: dateOnly(parsed.data.date),
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ closedDate }, { status: 201 });
}
