import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import {
  hasActiveBooking,
  isLocked,
  isMember,
  notifyGroup,
  seatsTaken,
  shiftText,
} from "@/lib/shifts";
import { SEATS_PER_SHIFT, slotCounselorLabel, slotMembers } from "@/lib/counselors";
import { SwapStatus } from "@/generated/prisma/enums";

function fail(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/** Take one free seat on an open shift. The shift opens for clients once both seats are taken. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();
  const { id } = await params;

  const now = new Date();
  const settings = await getShiftSettings();

  const slot = await prisma.slot.findUnique({ where: { id } });
  if (!slot) return fail("not_found", "ไม่พบเวรนี้", 404);
  if (isMember(slot, me.id)) return fail("already_member", "คุณลงเวรนี้อยู่แล้ว", 409);
  if (seatsTaken(slot) >= SEATS_PER_SHIFT) return fail("slot_full", "เวรนี้มีผู้ให้คำปรึกษาครบ 2 คนแล้ว", 409);
  if (slot.startsAt <= now) return fail("past", "เวรนี้เลยเวลาไปแล้ว", 409);

  const closed = await prisma.closedDate.findUnique({ where: { date: slot.date } });
  if (closed) return fail("date_closed", "วันนี้ปิดทำการ", 409);

  if (settings.maxShiftsPerPerson > 0) {
    const held = await prisma.slot.count({
      where: {
        startsAt: { gte: now },
        OR: [{ counselorId: me.id }, { partnerId: me.id }],
      },
    });
    if (held >= settings.maxShiftsPerPerson) {
      return fail(
        "limit_reached",
        `คุณลงเวรครบ ${settings.maxShiftsPerPerson} เวรแล้ว หากต้องการลงเพิ่มให้ยกเลิกเวรเดิมก่อน`,
        409
      );
    }
  }

  // Atomic: seat 1 first, otherwise seat 2. Each update only matches while that seat is still free.
  let claimed = await prisma.slot.updateMany({
    where: { id, counselorId: null },
    data: { counselorId: me.id },
  });
  if (claimed.count !== 1) {
    claimed = await prisma.slot.updateMany({
      where: { id, partnerId: null, counselorId: { not: null }, NOT: { counselorId: me.id } },
      data: { partnerId: me.id },
    });
  }
  if (claimed.count !== 1) return fail("slot_full", "เวรนี้มีผู้ให้คำปรึกษาครบ 2 คนแล้ว", 409);

  const after = await prisma.slot.findUniqueOrThrow({
    where: { id },
    include: { counselor: true, partner: true },
  });
  const members = slotMembers(after);
  await notifyGroup(
    members,
    members.length === SEATS_PER_SHIFT
      ? `เวรครบ 2 คนแล้ว ✅ ${shiftText(after)} (${slotCounselorLabel(after)}) เปิดให้จองคิวได้แล้ว`
      : `${me.name} ลงเวร ${shiftText(after)} รออีก 1 คน`
  );
  return NextResponse.json({ ok: true, full: members.length === SEATS_PER_SHIFT });
}

/** Give up my seat. If the other counselor stays, they move to seat 1 and the shift closes to clients. */
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
  if (!slot || !isMember(slot, me.id)) return fail("not_found", "ไม่พบเวรของคุณ", 404);
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

  const others = slotMembers(slot).filter((m) => m.id !== me.id);
  const guard = { id, counselorId: slot.counselorId, partnerId: slot.partnerId };
  const next = { counselorId: slot.partnerId === me.id ? slot.counselorId : slot.partnerId, partnerId: null };

  const released = await prisma.$transaction(async (tx) => {
    const res = await tx.slot.updateMany({ where: guard, data: next });
    if (res.count !== 1) return false;
    await tx.swapRequest.updateMany({
      where: {
        status: SwapStatus.PENDING,
        OR: [
          { fromSlotId: id, requestedById: me.id },
          { toSlotId: id, targetId: me.id },
        ],
      },
      data: { status: SwapStatus.CANCELLED, resolvedAt: new Date() },
    });
    return true;
  });
  if (!released) return fail("stale", "เวรมีการเปลี่ยนแปลงระหว่างนี้ กรุณาโหลดหน้าใหม่", 409);

  await notifyGroup(
    [me, ...others],
    `${me.name} ยกเลิกเวร ❌ ${shiftText(slot)} ${
      others.length ? `ตอนนี้เหลือ ${others.map((o) => o.name).join(", ")} รออีก 1 คน` : "ตอนนี้เวรนี้ว่าง"
    }`
  );
  return NextResponse.json({ ok: true });
}
