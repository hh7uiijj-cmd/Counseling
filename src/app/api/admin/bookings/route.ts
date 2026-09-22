import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/generated/prisma/enums";

const VALID_STATUSES = new Set(Object.values(BookingStatus));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.has(statusParam as BookingStatus)
      ? (statusParam as BookingStatus)
      : undefined;

  const bookings = await prisma.booking.findMany({
    where: status ? { status } : undefined,
    include: {
      slot: { include: { counselor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bookings });
}
