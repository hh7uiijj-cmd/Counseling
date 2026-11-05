import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { hasActiveBooking, isLocked, isMember, notifyGroup, seatOf, shiftText } from "@/lib/shifts";
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
    include: { fromSlot: { include }, toSlot: { include }, requestedBy: true, target: true },
  });
  if (!req || req.status !== SwapStatus.PENDING) {
    return fail("not_pending", "คำขอนี้ถูกดำเนินการไปแล้วหรือไม่มีอยู่", 404);
  }

  const { fromSlot, toSlot, requestedBy, target } = req;
  const now = new Date();

  if (action === "cancel") {
    if (req.requestedById !== me.id) return fail("forbidden", "ไม่ใช่คำขอของคุณ", 403);
    await prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.CANCELLED, resolvedAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  // accept / decline are decided by the person who was asked
  if (req.targetId !== me.id) return fail("forbidden", "คำขอนี้ไม่ได้ส่งถึงคุณ", 403);

  if (action === "decline") {
    await prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.DECLINED, resolvedAt: now },
    });
    await notifyGroup(
      [requestedBy],
      `${target.name} ปฏิเสธคำขอสลับเวร ${shiftText(fromSlot)} ↔ ${shiftText(toSlot)} ❌`
    );
    return NextResponse.json({ ok: true });
  }

  // accept: re-check that nothing moved, then trade the two seats atomically
  const settings = await getShiftSettings();
  const fromSeat = seatOf(fromSlot, requestedBy.id);
  const toSeat = seatOf(toSlot, target.id);
  if (!fromSeat || !toSeat || isMember(fromSlot, target.id) || isMember(toSlot, requestedBy.id)) {
    return fail("stale", "เวรมีการเปลี่ยนแปลงแล้ว คำขอนี้ใช้ไม่ได้", 409);
  }
  if (hasActiveBooking(fromSlot) || hasActiveBooking(toSlot)) {
    return fail("has_booking", "สลับไม่ได้ เพราะมีผู้จองในเวรใดเวรหนึ่งแล้ว", 409);
  }
  if (isLocked(fromSlot, settings.changeCutoffHours) || isLocked(toSlot, settings.changeCutoffHours)) {
    return fail("locked", "สลับไม่ได้ เพราะใกล้ถึงเวลาเวรแล้ว", 409);
  }

  const swapped = await prisma
    .$transaction(async (tx) => {
      // Each update only matches while that exact person still holds that seat.
      const a = await tx.slot.updateMany({
        where: { id: fromSlot.id, [fromSeat]: requestedBy.id },
        data: { [fromSeat]: target.id },
      });
      const b = await tx.slot.updateMany({
        where: { id: toSlot.id, [toSeat]: target.id },
        data: { [toSeat]: requestedBy.id },
      });
      if (a.count !== 1 || b.count !== 1) throw new Error("stale");
      await tx.swapRequest.update({
        where: { id },
        data: { status: SwapStatus.ACCEPTED, resolvedAt: now },
      });
      // Any other pending request touching these two people on these two shifts is now void.
      await tx.swapRequest.updateMany({
        where: {
          status: SwapStatus.PENDING,
          id: { not: id },
          AND: [
            {
              OR: [
                { fromSlotId: { in: [fromSlot.id, toSlot.id] } },
                { toSlotId: { in: [fromSlot.id, toSlot.id] } },
              ],
            },
            {
              OR: [
                { requestedById: { in: [requestedBy.id, target.id] } },
                { targetId: { in: [requestedBy.id, target.id] } },
              ],
            },
          ],
        },
        data: { status: SwapStatus.CANCELLED, resolvedAt: now },
      });
      return true;
    })
    .catch(() => false);

  if (!swapped) return fail("stale", "เวรมีการเปลี่ยนแปลงระหว่างนี้ กรุณาโหลดหน้าใหม่", 409);

  await notifyGroup(
    [requestedBy, target],
    `สลับเวรสำเร็จ ✅ ${requestedBy.name} ↔ ${target.name} (${shiftText(fromSlot)} ↔ ${shiftText(toSlot)})`
  );
  return NextResponse.json({ ok: true });
}
