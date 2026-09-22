import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toDateKey, toTimeKey } from "@/lib/dates";
import { buildBookingFlexMessage, pushMessageToGroup } from "@/lib/line";
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
      include: { booking: true, counselor: true },
    });

    if (!slot || !slot.counselor.active) {
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

  try {
    const dateKey = toDateKey(slot.date);
    const topicLabel =
      booking.topicCategory === ConsultationTopic.OTHER
        ? booking.topicOther || TOPIC_LABELS.OTHER
        : TOPIC_LABELS[booking.topicCategory];
    const message = buildBookingFlexMessage({
      bookingId: booking.id,
      counselorName: slot.counselor.name,
      clientName: booking.clientName,
      studentId: booking.studentId,
      faculty: FACULTY_LABELS[booking.faculty] || booking.faculty,
      major: booking.major,
      clientPhone: booking.clientPhone,
      lineId: booking.lineId,
      consultationFormat: FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat,
      topic: topicLabel,
      dateKey,
      startTime: toTimeKey(slot.startsAt),
      endTime: toTimeKey(slot.endsAt),
    });
    const pushResult = await pushMessageToGroup([message]);
    if (pushResult.ok) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { lineNotified: true },
      });
    }
  } catch (err) {
    console.error("Failed to send LINE notification", err);
  }

  return NextResponse.json({ booking }, { status: 201 });
}
