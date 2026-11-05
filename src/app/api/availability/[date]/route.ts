import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOnly, toTimeKey } from "@/lib/dates";
import {
  slotCounselorLabel,
  slotIsActive,
  slotMembers,
} from "@/lib/counselors";
import { effectivePhotoUrl } from "@/lib/photos";
import { BookingStatus } from "@/generated/prisma/enums";

const MEMBER_SELECT = {
  id: true,
  name: true,
  title: true,
  color: true,
  photoUrl: true,
  photoUpdatedAt: true,
  fullName: true,
  active: true,
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const closedDate = await prisma.closedDate.findUnique({
    where: { date: dateOnly(date) },
  });

  const slots = await prisma.slot.findMany({
    where: {
      date: dateOnly(date),
      counselor: { active: true },
    },
    include: {
      counselor: { select: MEMBER_SELECT },
      partner: { select: MEMBER_SELECT },
      booking: { select: { status: true } },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  const items = slots.flatMap((slot) =>
    !slot.counselor || !slotIsActive(slot)
      ? []
      : [
          {
            id: slot.id,
            counselorId: slot.counselor.id,
            counselorName: slotCounselorLabel(slot),
            members: slotMembers(slot).map((m) => ({
              id: m.id,
              name: m.name,
              title: m.title,
              fullName: m.fullName,
              photoUrl: effectivePhotoUrl(m),
              color: m.color,
            })),
            counselorTitle: slot.counselor.title,
            counselorColor: slot.counselor.color,
            startTime: toTimeKey(slot.startsAt),
            endTime: toTimeKey(slot.endsAt),
            available:
              closedDate == null &&
              (!slot.booking ||
                slot.booking.status === BookingStatus.CANCELLED),
          },
        ],
  );

  return NextResponse.json({
    date,
    closed: Boolean(closedDate),
    closedReason: closedDate?.reason ?? null,
    slots: items,
  });
}
