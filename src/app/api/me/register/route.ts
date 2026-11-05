import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLineIdToken } from "@/lib/line";
import { createCounselorSession } from "@/lib/counselorSession";
import { parsePhotoDataUrl } from "@/lib/photos";

const schema = z.object({
  idToken: z.string().min(10),
  nickname: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(1).max(100),
  photo: z.string().max(700_000).optional(),
});

/** First sign-in: the counselor creates their own profile (nickname, full name, photo) on the sign-up page. */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", message: "กรุณากรอกชื่อเล่นและชื่อจริง" },
      { status: 400 }
    );
  }
  const identity = await verifyLineIdToken(parsed.data.idToken);
  if (!identity) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const existing = await prisma.counselor.findFirst({ where: { lineUserId: identity.userId } });
  if (existing) {
    await createCounselorSession(existing.id);
    return NextResponse.json({ status: "ok", name: existing.name });
  }

  const { nickname, fullName, photo } = parsed.data;
  const dup = await prisma.counselor.findFirst({
    where: { name: { equals: nickname, mode: "insensitive" } },
  });
  if (dup) {
    return NextResponse.json(
      { error: "name_taken", message: "ชื่อเล่นนี้มีคนใช้แล้ว กรุณาใช้ชื่อเล่นอื่น" },
      { status: 409 }
    );
  }
  let decoded: ReturnType<typeof parsePhotoDataUrl> = null;
  if (photo) {
    decoded = parsePhotoDataUrl(photo);
    if (!decoded) {
      return NextResponse.json(
        { error: "bad_photo", message: "รูปไม่ถูกต้องหรือใหญ่เกินไป" },
        { status: 400 }
      );
    }
  }

  const counselor = await prisma.counselor.create({
    data: {
      name: nickname,
      fullName,
      lineUserId: identity.userId,
      ...(decoded
        ? {
            photoUpdatedAt: new Date(),
            photo: { create: { data: new Uint8Array(decoded.data), contentType: decoded.contentType } },
          }
        : {}),
    },
  });
  await createCounselorSession(counselor.id);
  return NextResponse.json({ status: "ok", name: counselor.name });
}
