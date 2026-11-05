import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import { toDateKey, toTimeKey } from "@/lib/dates";
import { buildStatusUpdateMessage, pushMessageToGroup } from "@/lib/line";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { slotCounselorLabel } from "@/lib/counselors";
import { FORMAT_LABELS } from "@/lib/formOptions";

type BookingWithSlot = {
  clientName: string;
  clientEmail: string;
  studentId: string | null;
  consultationFormat: string;
  slot: {
    date: Date;
    startsAt: Date;
    endsAt: Date;
    counselor: { id: string; name: string };
    partner?: { id: string; name: string } | null;
  };
};

export async function notifyBookingStatus(booking: BookingWithSlot, status: BookingStatus) {
  const dateKey = toDateKey(booking.slot.date);
  const startTime = toTimeKey(booking.slot.startsAt);
  const endTime = toTimeKey(booking.slot.endsAt);

  try {
    const message = buildStatusUpdateMessage({
      clientName: booking.clientName,
      counselorName: slotCounselorLabel(booking.slot),
      dateKey,
      startTime,
      endTime,
      status,
    });
    await pushMessageToGroup([message]);
  } catch (err) {
    console.error("Failed to send LINE status update", err);
  }

  if (status === BookingStatus.CONFIRMED) {
    try {
      await sendBookingConfirmationEmail({
        to: booking.clientEmail,
        clientName: booking.clientName,
        studentId: booking.studentId,
        counselorName: slotCounselorLabel(booking.slot),
        dateKey,
        startTime,
        endTime,
        consultationFormat: FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat,
      });
    } catch (err) {
      console.error("Failed to send confirmation email", err);
    }
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
    include: { slot: { include: { counselor: true, partner: true } } },
  });
  await notifyBookingStatus(booking, status);
  return booking;
}
