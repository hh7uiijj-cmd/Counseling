import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLineIdToken } from "@/lib/line";
import { createCounselorSession } from "@/lib/counselorSession";

const schema = z.object({ idToken: z.string().min(10), counselorId: z.string().min(1) });

/** First-time sign-in: link this LINE account to the chosen (still unlinked) counselor. */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const identity = await verifyLineIdToken(parsed.data.idToken);
  if (!identity) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const already = await prisma.counselor.findFirst({ where: { lineUserId: identity.userId } });
  if (already) {
    await createCounselorSession(already.id);
    return NextResponse.json({ status: "ok", name: already.name });
  }

  // Only claim a counselor that is still unlinked, atomically.
  const claimed = await prisma.counselor.updateMany({
    where: { id: parsed.data.counselorId, lineUserId: null, active: true },
    data: { lineUserId: identity.userId },
  });
  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: "already_linked", message: "ชื่อนี้ถูกผูกบัญชีแล้ว กรุณาเลือกใหม่หรือแจ้งแอดมิน" },
      { status: 409 }
    );
  }

  await createCounselorSession(parsed.data.counselorId);
  const counselor = await prisma.counselor.findUnique({ where: { id: parsed.data.counselorId } });
  return NextResponse.json({ status: "ok", name: counselor?.name });
}
