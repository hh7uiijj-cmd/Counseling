import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const slot = await prisma.slot.findUnique({
    where: { id },
    include: { booking: true },
  });

  if (!slot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (slot.booking && ["PENDING", "CONFIRMED"].includes(slot.booking.status)) {
    return NextResponse.json(
      {
        error: "has_active_booking",
        message: "คิวนี้มีการจองอยู่ กรุณายกเลิกการจองก่อนลบคิว",
      },
      { status: 409 }
    );
  }

  await prisma.slot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
