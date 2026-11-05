import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  fullName: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(100).optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
  lineUserId: z.string().nullable().optional(),
  partnerId: z.string().min(1).nullable().optional(),
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

  const { partnerId, ...rest } = parsed.data;

  if (partnerId === id) {
    return NextResponse.json(
      { error: "invalid_partner", message: "ไม่สามารถจับคู่กับตัวเองได้" },
      { status: 400 }
    );
  }

  const counselor = await prisma.$transaction(async (tx) => {
    if (partnerId !== undefined) {
      const current = await tx.counselor.findUnique({ where: { id } });
      if (!current) return null;
      const target = partnerId
        ? await tx.counselor.findUnique({ where: { id: partnerId } })
        : null;
      if (partnerId && !target) return null;

      // Pairs are symmetric and one-to-one: release both sides of any old pair first.
      const toRelease = [id, current.partnerId, partnerId, target?.partnerId].filter(
        (v): v is string => Boolean(v)
      );
      await tx.counselor.updateMany({
        where: { id: { in: toRelease } },
        data: { partnerId: null },
      });
      if (partnerId) {
        await tx.counselor.update({ where: { id }, data: { partnerId } });
        await tx.counselor.update({ where: { id: partnerId }, data: { partnerId: id } });
      }
    }
    // Setting/clearing a photo link by hand replaces any photo the counselor uploaded.
    if (rest.photoUrl !== undefined) {
      await tx.counselorPhoto.deleteMany({ where: { counselorId: id } });
      return tx.counselor.update({ where: { id }, data: { ...rest, photoUpdatedAt: null } });
    }
    return tx.counselor.update({ where: { id }, data: rest });
  });

  if (!counselor) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ counselor });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bookingCount = await prisma.booking.count({
    where: { slot: { OR: [{ counselorId: id }, { partnerId: id }] }, status: { in: ["PENDING", "CONFIRMED"] } },
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
