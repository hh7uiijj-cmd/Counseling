import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/generated/prisma/enums";

const updateSchema = z.object({
  status: z.enum([
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ]),
});

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

  const booking = await prisma.booking.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { slot: { include: { counselor: true } } },
  });

  return NextResponse.json({ booking });
}
