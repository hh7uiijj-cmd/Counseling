import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionCounselor, unauthorized } from "@/lib/counselorSession";
import { parsePhotoDataUrl } from "@/lib/photos";
import { DEFAULT_COUNSELOR_TITLE } from "@/lib/counselors";

const schema = z.object({
  nickname: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(100).default(DEFAULT_COUNSELOR_TITLE),
  photo: z.string().max(700_000).optional(), // omit = keep current photo
});

/** Edit my own nickname, full name and photo. */
export async function PUT(request: NextRequest) {
  const me = await getSessionCounselor();
  if (!me) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", message: "กรุณากรอกชื่อเล่นและชื่อจริง" },
      { status: 400 }
    );
  }
  const { nickname, fullName, title, photo } = parsed.data;

  const dup = await prisma.counselor.findFirst({
    where: { name: { equals: nickname, mode: "insensitive" }, id: { not: me.id } },
  });
  if (dup) {
    return NextResponse.json(
      { error: "name_taken", message: "ชื่อเล่นนี้มีคนใช้แล้ว กรุณาใช้ชื่อเล่นอื่น" },
      { status: 409 }
    );
  }
  const decoded = photo ? parsePhotoDataUrl(photo) : null;
  if (photo && !decoded) {
    return NextResponse.json(
      { error: "bad_photo", message: "รูปไม่ถูกต้องหรือใหญ่เกินไป" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.counselor.update({
      where: { id: me.id },
      data: { name: nickname, fullName, title, ...(decoded ? { photoUpdatedAt: new Date() } : {}) },
    });
    if (decoded) {
      const data = new Uint8Array(decoded.data);
      await tx.counselorPhoto.upsert({
        where: { counselorId: me.id },
        create: { counselorId: me.id, data, contentType: decoded.contentType },
        update: { data, contentType: decoded.contentType },
      });
    }
  });
  return NextResponse.json({ ok: true });
}
