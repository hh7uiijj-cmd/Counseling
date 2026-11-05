import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLineIdToken } from "@/lib/line";
import { createCounselorSession } from "@/lib/counselorSession";

const schema = z.object({ idToken: z.string().min(10) });

/** Sign in from LIFF. If this LINE account isn't linked yet, return the names it may claim. */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const identity = await verifyLineIdToken(parsed.data.idToken);
  if (!identity) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const counselor = await prisma.counselor.findFirst({
    where: { lineUserId: identity.userId, active: true },
  });
  if (counselor) {
    await createCounselorSession(counselor.id);
    return NextResponse.json({ status: "ok", name: counselor.name });
  }

  const options = await prisma.counselor.findMany({
    where: { lineUserId: null, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ status: "needs_link", options });
}
