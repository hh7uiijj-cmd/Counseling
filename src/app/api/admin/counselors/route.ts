import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  color: z.string().optional(),
});

export async function GET() {
  const counselors = await prisma.counselor.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { slots: true },
      },
    },
  });
  return NextResponse.json({ counselors });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const counselor = await prisma.counselor.create({ data: parsed.data });
  return NextResponse.json({ counselor }, { status: 201 });
}
