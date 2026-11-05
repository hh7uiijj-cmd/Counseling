import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey } from "@/lib/dates";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { ownsSlot, toShiftItem } from "@/lib/shifts";
import { SwapStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();

  const now = new Date();
  const settings = await getShiftSettings();

  const [slots, closedDates, swaps] = await Promise.all([
    prisma.slot.findMany({
      where: { startsAt: { gte: now } },
      include: { counselor: true, partner: true, booking: { select: { status: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.closedDate.findMany({ where: { date: { gte: dateOnly(toDateKey(now)) } } }),
    prisma.swapRequest.findMany({
      where: { status: SwapStatus.PENDING },
      include: {
        fromSlot: { include: { counselor: true, partner: true, booking: { select: { status: true } } } },
        toSlot: { include: { counselor: true, partner: true, booking: { select: { status: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const closed = new Set(closedDates.map((c) => toDateKey(c.date)));
  const item = (s: (typeof slots)[number]) => toShiftItem(s, settings.changeCutoffHours, now);

  const mine = slots.filter((s) => ownsSlot(s, me.id));
  const open = slots.filter((s) => s.counselorId === null && !closed.has(toDateKey(s.date)));
  const others = slots.filter((s) => s.counselorId !== null && !ownsSlot(s, me.id));

  const incoming = swaps.filter((r) => ownsSlot(r.toSlot, me.id));
  const outgoing = swaps.filter((r) => ownsSlot(r.fromSlot, me.id));

  return NextResponse.json({
    counselor: { id: me.id, name: me.name },
    partner: me.partner ? { id: me.partner.id, name: me.partner.name } : null,
    settings,
    myCount: mine.length,
    myShifts: mine.map(item),
    openShifts: open.map(item),
    otherShifts: others.map(item),
    incoming: incoming.map((r) => ({ id: r.id, from: item(r.fromSlot), to: item(r.toSlot) })),
    outgoing: outgoing.map((r) => ({ id: r.id, from: item(r.fromSlot), to: item(r.toSlot) })),
  });
}
