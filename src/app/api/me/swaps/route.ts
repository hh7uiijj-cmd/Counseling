import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { hasActiveBooking, isLocked, isMember, notifyGroup, shiftText } from "@/lib/shifts";
import { SwapStatus } from "@/generated/prisma/enums";

const schema = z.object({
  fromSlotId: z.string().min(1),
  toSlotId: z.string().min(1),
  targetId: z.string().min(1),
});

function fail(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/** Ask `targetId` (sitting on toSlot) to trade places with me (sitting on fromSlot). */
export async function POST(request: NextRequest) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input", "ข้อมูลไม่ถูกต้อง", 400);
  const { fromSlotId, toSlotId, targetId } = parsed.data;
  if (fromSlotId === toSlotId || targetId === me.id) {
    return fail("invalid_input", "เลือกสลับกับตัวเองไม่ได้", 400);
  }

  const settings = await getShiftSettings();
  const include = { counselor: true, partner: true, booking: { select: { status: true } } };
  const [from, to] = await Promise.all([
    prisma.slot.findUnique({ where: { id: fromSlotId }, include }),
    prisma.slot.findUnique({ where: { id: toSlotId }, include }),
  ]);

  if (!from || !isMember(from, me.id)) return fail("not_found", "ไม่พบเวรของคุณ", 404);
  if (!to || !isMember(to, targetId)) return fail("not_found", "คนที่ต้องการสลับด้วยไม่ได้อยู่ในเวรนั้นแล้ว", 404);
  if (isMember(to, me.id)) return fail("invalid_input", "คุณอยู่ในเวรนั้นอยู่แล้ว", 400);
  if (isMember(from, targetId)) return fail("invalid_input", "คนนั้นอยู่ในเวรของคุณอยู่แล้ว", 400);
  if (hasActiveBooking(from) || hasActiveBooking(to)) {
    return fail("has_booking", "สลับไม่ได้ เพราะมีผู้จองในเวรใดเวรหนึ่งแล้ว", 409);
  }
  if (isLocked(from, settings.changeCutoffHours) || isLocked(to, settings.changeCutoffHours)) {
    return fail("locked", `สลับไม่ได้ เพราะใกล้ถึงเวลาเวรแล้ว (ต้องล่วงหน้าอย่างน้อย ${settings.changeCutoffHours} ชม.)`, 409);
  }

  const existing = await prisma.swapRequest.findFirst({
    where: { status: SwapStatus.PENDING, fromSlotId, toSlotId, requestedById: me.id, targetId },
  });
  if (existing) return fail("duplicate", "ส่งคำขอสลับนี้ไปแล้ว รอคนนั้นตอบรับ", 409);

  await prisma.swapRequest.create({
    data: { fromSlotId, toSlotId, requestedById: me.id, targetId },
  });

  const target = [to.counselor, to.partner].find((c) => c?.id === targetId)!;
  await notifyGroup(
    [target],
    `คำขอสลับเวร 🔁 ${me.name} (เวร ${shiftText(from)}) ขอสลับกับเวร ${shiftText(to)} ของคุณ กรุณาเปิดหน้าลงเวรเพื่อกดยอมรับหรือปฏิเสธ`
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
