import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { hasActiveBooking, isLocked, notifyGroup, ownsSlot, pairPeople, shiftText } from "@/lib/shifts";
import { SwapStatus } from "@/generated/prisma/enums";

const schema = z.object({ action: z.enum(["accept", "decline", "cancel"]) });

function fail(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input", "ข้อมูลไม่ถูกต้อง", 400);
  const { action } = parsed.data;

  const include = { counselor: true, partner: true, booking: { select: { status: true } } };
  const req = await prisma.swapRequest.findUnique({
    where: { id },
    include: { fromSlot: { include }, toSlot: { include } },
  });
  if (!req || req.status !== SwapStatus.PENDING) {
    return fail("not_pending", "คำขอนี้ถูกดำเนินการไปแล้วหรือไม่มีอยู่", 404);
  }

  const { fromSlot, toSlot } = req;
  const now = new Date();

  if (action === "cancel") {
    if (!ownsSlot(fromSlot, me.id)) return fail("forbidden", "ไม่ใช่คำขอของคู่คุณ", 403);
    await prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.CANCELLED, resolvedAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  // accept / decline are decided by the pair that was asked (holds toSlot)
  if (!ownsSlot(toSlot, me.id)) return fail("forbidden", "คำขอนี้ไม่ได้ส่งถึงคู่ของคุณ", 403);

  if (action === "decline") {
    await prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.DECLINED, resolvedAt: now },
    });
    await notifyGroup(
      pairPeople(fromSlot),
      `คำขอสลับเวร ${shiftText(fromSlot)} ↔ ${shiftText(toSlot)} ถูกปฏิเสธ ❌`
    );
    return NextResponse.json({ ok: true });
  }

  // accept: re-check the world hasn't changed, then trade the two pairs atomically
  const settings = await getShiftSettings();
  if (fromSlot.counselorId === null || toSlot.counselorId === null) {
    return fail("stale", "เวรใดเวรหนึ่งไม่มีเจ้าของแล้ว", 409);
  }
  if (hasActiveBooking(fromSlot) || hasActiveBooking(toSlot)) {
    return fail("has_booking", "สลับไม่ได้ เพราะมีผู้จองในเวรใดเวรหนึ่งแล้ว", 409);
  }
  if (isLocked(fromSlot, settings.changeCutoffHours) || isLocked(toSlot, settings.changeCutoffHours)) {
    return fail("locked", "สลับไม่ได้ เพราะใกล้ถึงเวลาเวรแล้ว", 409);
  }

  const fromPair = { counselorId: fromSlot.counselorId, partnerId: fromSlot.partnerId };
  const toPair = { counselorId: toSlot.counselorId, partnerId: toSlot.partnerId };

  const swapped = await prisma.$transaction(async (tx) => {
    // Guard with the owners we just read so a concurrent change makes this a no-op.
    const a = await tx.slot.updateMany({ where: { id: fromSlot.id, ...fromPair }, data: toPair });
    const b = await tx.slot.updateMany({ where: { id: toSlot.id, ...toPair }, data: fromPair });
    if (a.count !== 1 || b.count !== 1) throw new Error("stale");
    await tx.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.ACCEPTED, resolvedAt: now },
    });
    await tx.swapRequest.updateMany({
      where: {
        status: SwapStatus.PENDING,
        id: { not: id },
        OR: [
          { fromSlotId: { in: [fromSlot.id, toSlot.id] } },
          { toSlotId: { in: [fromSlot.id, toSlot.id] } },
        ],
      },
      data: { status: SwapStatus.CANCELLED, resolvedAt: now },
    });
    return true;
  }).catch(() => false);

  if (!swapped) return fail("stale", "เวรมีการเปลี่ยนแปลงระหว่างนี้ กรุณาโหลดหน้าใหม่", 409);

  await notifyGroup(
    [...pairPeople(fromSlot), ...pairPeople(toSlot)],
    `สลับเวรสำเร็จ ✅ ${shiftText(fromSlot)} ↔ ${shiftText(toSlot)}`
  );
  return NextResponse.json({ ok: true });
}
