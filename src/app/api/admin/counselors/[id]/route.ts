import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const counselor = await prisma.counselor.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ counselor });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bookingCount = await prisma.booking.count({
    where: { slot: { counselorId: id }, status: { in: ["PENDING", "CONFIRMED"] } },
  });

  if (bookingCount > 0) {
    return NextResponse.json(
      {
        error: "has_active_bookings",
        message:
          "ผู้ให้คำปรึกษาคนนี้มีการจองที่ยังไม่เสร็จสิ้นอยู่ กรุณายกเลิก/ปิดการใช้งานแทนการลบ",
      },
      { status: 409 }
    );
  }

  await prisma.counselor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
