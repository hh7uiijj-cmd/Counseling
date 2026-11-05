import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { hasActiveBooking, isLocked, notifyGroup, ownsSlot, pairPeople, shiftText } from "@/lib/shifts";
import { slotCounselorLabel } from "@/lib/counselors";
import { SwapStatus } from "@/generated/prisma/enums";

function fail(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/** Claim an open shift for my whole pair. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();
  const { id } = await params;

  if (!me.partner || !me.partner.active) {
    return fail("no_pair", "คุณยังไม่มีคู่เวร กรุณาแจ้งแอดมินให้จับคู่ก่อน", 400);
  }

  const now = new Date();
  const settings = await getShiftSettings();

  const slot = await prisma.slot.findUnique({
    where: { id },
    include: { counselor: true, partner: true },
  });
  if (!slot) return fail("not_found", "ไม่พบเวรนี้", 404);
  if (slot.counselorId !== null) return fail("slot_taken", "เวรนี้มีคู่อื่นลงไปแล้ว", 409);
  if (slot.startsAt <= now) return fail("past", "เวรนี้เลยเวลาไปแล้ว", 409);

  const closed = await prisma.closedDate.findUnique({ where: { date: slot.date } });
  if (closed) return fail("date_closed", "วันนี้ปิดทำการ", 409);

  if (settings.maxShiftsPerPair > 0) {
    const held = await prisma.slot.count({
      where: {
        startsAt: { gte: now },
        OR: [{ counselorId: me.id }, { partnerId: me.id }],
      },
    });
    if (held >= settings.maxShiftsPerPair) {
      return fail(
        "limit_reached",
        `คู่ของคุณลงเวรครบ ${settings.maxShiftsPerPair} เวรแล้ว หากต้องการลงเพิ่มให้ยกเลิกเวรเดิมก่อน`,
        409
      );
    }
  }

  // Atomic claim: only succeeds while the slot is still open.
  const claimed = await prisma.slot.updateMany({
    where: { id, counselorId: null },
    data: { counselorId: me.id, partnerId: me.partner.id },
  });
  if (claimed.count !== 1) return fail("slot_taken", "เวรนี้มีคู่อื่นลงไปแล้ว", 409);

  await notifyGroup(
    [me, me.partner],
    `ลงเวรแล้ว ✅ ${shiftText(slot)} (${me.name} และ ${me.partner.name})`
  );
  return NextResponse.json({ ok: true });
}

/** Release a shift my pair holds, making it open again. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();
  const { id } = await params;

  const settings = await getShiftSettings();
  const slot = await prisma.slot.findUnique({
    where: { id },
    include: { counselor: true, partner: true, booking: { select: { status: true } } },
  });
  if (!slot || !ownsSlot(slot, me.id)) return fail("not_found", "ไม่พบเวรของคุณ", 404);
  if (hasActiveBooking(slot)) {
    return fail("has_booking", "เวรนี้มีผู้จองแล้ว กรุณาติดต่อแอดมินเพื่อยกเลิก", 409);
  }
  if (isLocked(slot, settings.changeCutoffHours)) {
    return fail(
      "locked",
      `ยกเลิกไม่ได้ เพราะใกล้ถึงเวลาเวรแล้ว (ต้องยกเลิกล่วงหน้าอย่างน้อย ${settings.changeCutoffHours} ชม.)`,
      409
    );
  }

  const label = slotCounselorLabel(slot);
  const people = pairPeople(slot);
  await prisma.$transaction([
    prisma.swapRequest.updateMany({
      where: {
        status: SwapStatus.PENDING,
        OR: [{ fromSlotId: id }, { toSlotId: id }],
      },
      data: { status: SwapStatus.CANCELLED, resolvedAt: new Date() },
    }),
    prisma.slot.update({ where: { id }, data: { counselorId: null, partnerId: null } }),
  ]);

  await notifyGroup(people, `ยกเลิกเวร ❌ ${shiftText(slot)} (${label}) ขณะนี้เวรนี้ว่างให้คู่อื่นลงได้`);
  return NextResponse.json({ ok: true });
}
