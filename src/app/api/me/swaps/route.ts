import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { hasActiveBooking, isLocked, notifyGroup, ownsSlot, pairPeople, shiftText } from "@/lib/shifts";
import { SwapStatus } from "@/generated/prisma/enums";

const schema = z.object({ fromSlotId: z.string().min(1), toSlotId: z.string().min(1) });

function fail(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/** Ask the pair holding `toSlotId` to trade it for my pair's `fromSlotId`. */
export async function POST(request: NextRequest) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input", "ข้อมูลไม่ถูกต้อง", 400);
  const { fromSlotId, toSlotId } = parsed.data;
  if (fromSlotId === toSlotId) return fail("invalid_input", "เลือกเวรเดียวกันไม่ได้", 400);

  const settings = await getShiftSettings();
  const include = { counselor: true, partner: true, booking: { select: { status: true } } };
  const [from, to] = await Promise.all([
    prisma.slot.findUnique({ where: { id: fromSlotId }, include }),
    prisma.slot.findUnique({ where: { id: toSlotId }, include }),
  ]);

  if (!from || !ownsSlot(from, me.id)) return fail("not_found", "ไม่พบเวรของคุณ", 404);
  if (!to || to.counselorId === null) return fail("not_found", "เวรที่ต้องการสลับไม่ได้อยู่กับคู่ใด", 404);
  if (ownsSlot(to, me.id)) return fail("invalid_input", "เวรทั้งสองเป็นของคู่คุณเอง", 400);
  if (hasActiveBooking(from) || hasActiveBooking(to)) {
    return fail("has_booking", "สลับไม่ได้ เพราะมีผู้จองในเวรใดเวรหนึ่งแล้ว", 409);
  }
  if (isLocked(from, settings.changeCutoffHours) || isLocked(to, settings.changeCutoffHours)) {
    return fail("locked", `สลับไม่ได้ เพราะใกล้ถึงเวลาเวรแล้ว (ต้องล่วงหน้าอย่างน้อย ${settings.changeCutoffHours} ชม.)`, 409);
  }

  const existing = await prisma.swapRequest.findFirst({
    where: { status: SwapStatus.PENDING, fromSlotId, toSlotId },
  });
  if (existing) return fail("duplicate", "ส่งคำขอสลับนี้ไปแล้ว รอคู่อีกฝั่งตอบรับ", 409);

  await prisma.swapRequest.create({
    data: { fromSlotId, toSlotId, requestedById: me.id },
  });

  await notifyGroup(
    pairPeople(to),
    `มีคำขอสลับเวร 🔁 ${me.name} (เวร ${shiftText(from)}) ขอสลับกับเวร ${shiftText(to)} ของคุณ กรุณาเปิดหน้าลงเวรเพื่อกดยอมรับหรือปฏิเสธ`
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
