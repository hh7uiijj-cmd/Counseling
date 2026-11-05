import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildMentionTextMessage, isLineConfigured, pushMessageToGroup } from "@/lib/line";
import { dateOnly, thaiDateLabel, toTimeKey } from "@/lib/dates";
import { slotMembers } from "@/lib/counselors";

/** Data for the announce page: who can be tagged, the sign-up link, and an optional day summary. */
export async function GET(request: NextRequest) {
  const summaryDate = request.nextUrl.searchParams.get("summaryDate");

  const counselors = await prisma.counselor.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, fullName: true, lineUserId: true },
  });

  const liffId = process.env.LIFF_ID;
  const signupUrl = liffId ? `https://liff.line.me/${liffId}` : null;

  let summary: string | null = null;
  if (summaryDate && /^\d{4}-\d{2}-\d{2}$/.test(summaryDate)) {
    const slots = await prisma.slot.findMany({
      where: { date: dateOnly(summaryDate) },
      orderBy: { startsAt: "asc" },
      include: { counselor: true, partner: true },
    });
    const lines = slots.map((s) => {
      const names = slotMembers(s).map((m) => m.name);
      const who =
        names.length === 2 ? names.join(" + ") : names.length === 1 ? `${names[0]} (รออีก 1 คน)` : "ยังว่าง";
      return `${toTimeKey(s.startsAt)}-${toTimeKey(s.endsAt)} น.  ${who}`;
    });
    summary = lines.length
      ? `📅 ตารางเวร ${thaiDateLabel(summaryDate)}\n${lines.join("\n")}`
      : `📅 ${thaiDateLabel(summaryDate)} ยังไม่มีเวร`;
  }

  return NextResponse.json({
    configured: isLineConfigured(),
    signupUrl,
    summary,
    counselors: counselors.map((c) => ({
      id: c.id,
      name: c.name,
      fullName: c.fullName,
      canTag: Boolean(c.lineUserId),
    })),
  });
}

const schema = z.object({
  text: z.string().trim().min(1).max(4500),
  mentionIds: z.array(z.string()).max(60).default([]),
});

/** Post an admin-written message to the LINE group, optionally tagging counselors. */
export async function POST(request: NextRequest) {
  if (!isLineConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", message: "กรุณาพิมพ์ข้อความ" }, { status: 400 });
  }

  const people = parsed.data.mentionIds.length
    ? await prisma.counselor.findMany({
        where: { id: { in: parsed.data.mentionIds }, lineUserId: { not: null } },
        select: { name: true, lineUserId: true },
      })
    : [];
  const mentionable = people.flatMap((p) => (p.lineUserId ? [{ name: p.name, lineUserId: p.lineUserId }] : []));

  // LINE allows at most 20 mentions per message.
  const result = await pushMessageToGroup([buildMentionTextMessage(mentionable.slice(0, 20), parsed.data.text)]);
  if (!result.ok) {
    return NextResponse.json(
      { error: "line_api_error", message: "ส่งไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า LINE", detail: result },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, tagged: Math.min(mentionable.length, 20) });
}
