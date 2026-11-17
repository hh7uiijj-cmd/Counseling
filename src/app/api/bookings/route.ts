import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { thaiDateLabel, toDateKey, toTimeKey } from "@/lib/dates";
import { sendAdminNotificationEmail } from "@/lib/email";
import { buildBookingFlexMessage, pushMessageToUser } from "@/lib/line";
import { bookingCardParams } from "@/lib/bookingMessages";
import { slotCounselorLabel, slotIsActive, slotMembers } from "@/lib/counselors";
import { TOPIC_LABELS, FACULTY_LABELS, FORMAT_LABELS } from "@/lib/formOptions";
import { BookingStatus, Gender, YearLevel, Faculty, ConsultationTopic, ConsultationFormat } from "@/generated/prisma/enums";

const createSchema = z
  .object({
    slotId: z.string().min(1),
    clientName: z.string().min(1).max(200),
    studentId: z.string().max(50).optional(),
    gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.LGBTQ]),
    yearLevel: z.enum([YearLevel.YEAR_1, YearLevel.YEAR_2, YearLevel.YEAR_3, YearLevel.YEAR_4]),
    faculty: z.enum(Object.values(Faculty) as [Faculty, ...Faculty[]]),
    major: z.string().min(1).max(200),
    topicCategory: z.enum([ConsultationTopic.STUDY, ConsultationTopic.LIFE, ConsultationTopic.OTHER]),
    topicOther: z.string().max(500).optional(),
    consultationFormat: z.enum([ConsultationFormat.ONLINE, ConsultationFormat.ONSITE]),
    clientPhone: z.string().min(6).max(30),
    clientEmail: z.string().email().max(254),
    lineId: z.string().min(1).max(100),
    note: z.string().max(1000).optional(),
  })
  .refine((data) => data.topicCategory !== ConsultationTopic.OTHER || Boolean(data.topicOther?.trim()), {
    message: "กรุณาระบุรายละเอียดเมื่อเลือก 'อื่นๆ'",
    path: ["topicOther"],
  });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    slotId,
    clientName,
    studentId,
    gender,
    yearLevel,
    faculty,
    major,
    topicCategory,
    topicOther,
    consultationFormat,
    clientPhone,
    clientEmail,
    lineId,
    note,
  } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
      include: { booking: true, counselor: true, partner: true },
    });

    if (!slot || !slotIsActive(slot)) {
      return { error: "slot_not_found" as const };
    }

    const closedDate = await tx.closedDate.findUnique({
      where: { date: slot.date },
    });
    if (closedDate) {
      return { error: "date_closed" as const };
    }

    if (slot.booking && slot.booking.status !== BookingStatus.CANCELLED) {
      return { error: "slot_taken" as const };
    }

    const data = {
      clientName,
      studentId: studentId || null,
      gender,
      yearLevel,
      faculty,
      major,
      topicCategory,
      topicOther: topicCategory === ConsultationTopic.OTHER ? topicOther || null : null,
      consultationFormat,
      clientPhone,
      clientEmail,
      lineId,
      note: note || null,
      status: BookingStatus.PENDING,
    };

    const booking = slot.booking
      ? await tx.booking.update({ where: { id: slot.booking.id }, data })
      : await tx.booking.create({ data: { ...data, slotId: slot.id } });

    return { booking, slot };
  });

  if ("error" in result) {
    const status = result.error === "slot_not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  const { booking, slot } = result;

  // LINE: send ONE card straight to each of the shift's counselors (1:1 push = 1 message each,
  // instead of a group push that counts once per group member). The group can also type "คิวใหม่"
  // to list pending bookings for free (reply).
  try {
    const card = buildBookingFlexMessage(bookingCardParams(booking, slot));
    const recipients = slotMembers(slot).flatMap((m) => (m.lineUserId ? [m.lineUserId] : []));
    const results = await Promise.all(recipients.map((id) => pushMessageToUser(id, [card])));
    if (results.some((r) => r.ok)) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { lineNotified: true },
      });
    }
  } catch (err) {
    console.error("Failed to send LINE notification", err);
  }

  // Email the admin too (works even when LINE is out of quota).
  try {
    await sendAdminNotificationEmail({
      subject: "มีการจองคิวใหม่",
      lines: [
        `วันที่ ${thaiDateLabel(toDateKey(slot.date))} เวลา ${toTimeKey(slot.startsAt)}-${toTimeKey(slot.endsAt)} น.`,
        `ผู้ให้คำปรึกษา: ${slotCounselorLabel(slot)}`,
        `ผู้ขอรับคำปรึกษา: ${booking.clientName}${booking.studentId ? ` (${booking.studentId})` : ""}`,
        `คณะ/สาขา: ${FACULTY_LABELS[booking.faculty] || booking.faculty} / ${booking.major}`,
        `รูปแบบ: ${FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat}`,
        `เบอร์โทร: ${booking.clientPhone} · LINE ID: ${booking.lineId} · อีเมล: ${booking.clientEmail}`,
        `หัวข้อ: ${
          booking.topicCategory === ConsultationTopic.OTHER
            ? booking.topicOther || TOPIC_LABELS.OTHER
            : TOPIC_LABELS[booking.topicCategory]
        }`,
      ],
      link: "/admin/bookings",
    });
  } catch (err) {
    console.error("Failed to send admin booking email", err);
  }

  return NextResponse.json({ booking }, { status: 201 });
}
