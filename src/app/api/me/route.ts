import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateKey } from "@/lib/dates";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { getShiftSettings } from "@/lib/settings";
import { isMember, seatsTaken, toShiftItem } from "@/lib/shifts";
import { SEATS_PER_SHIFT } from "@/lib/counselors";
import { effectivePhotoUrl } from "@/lib/photos";
import { SwapStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();

  const now = new Date();
  const settings = await getShiftSettings();
  const include = { counselor: true, partner: true, booking: { select: { status: true } } };

  const [slots, closedDates, swaps] = await Promise.all([
    prisma.slot.findMany({
      where: { startsAt: { gte: now } },
      include,
      orderBy: { startsAt: "asc" },
    }),
    prisma.closedDate.findMany({ where: { date: { gte: dateOnly(toDateKey(now)) } } }),
    prisma.swapRequest.findMany({
      where: {
        status: SwapStatus.PENDING,
        OR: [{ requestedById: me.id }, { targetId: me.id }],
      },
      include: { fromSlot: { include }, toSlot: { include }, requestedBy: true, target: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const closed = new Set(closedDates.map((c) => toDateKey(c.date)));
  const item = (s: (typeof slots)[number]) => toShiftItem(s, settings.changeCutoffHours, now);

  const mine = slots.filter((s) => isMember(s, me.id));
  const open = slots.filter(
    (s) => seatsTaken(s) < SEATS_PER_SHIFT && !isMember(s, me.id) && !closed.has(toDateKey(s.date))
  );
  // Everyone else I could ask to trade places with.
  const swapTargets = slots
    .filter((s) => !isMember(s, me.id))
    .flatMap((s) =>
      [s.counselor, s.partner].flatMap((c) =>
        c ? [{ ...item(s), targetId: c.id, targetName: c.name }] : []
      )
    );

  const swapItem = (r: (typeof swaps)[number]) => ({
    id: r.id,
    from: item(r.fromSlot),
    to: item(r.toSlot),
    requesterName: r.requestedBy.name,
    targetName: r.target.name,
  });

  return NextResponse.json({
    counselor: {
      id: me.id,
      name: me.name,
      fullName: me.fullName,
      photoUrl: effectivePhotoUrl(me),
    },
    settings,
    myCount: mine.length,
    myShifts: mine.map(item),
    openShifts: open.map(item),
    swapTargets,
    incoming: swaps.filter((r) => r.targetId === me.id).map(swapItem),
    outgoing: swaps.filter((r) => r.requestedById === me.id).map(swapItem),
  });
}
