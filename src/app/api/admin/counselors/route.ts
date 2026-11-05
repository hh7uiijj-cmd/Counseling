import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectivePhotoUrl } from "@/lib/photos";
import { DEFAULT_COUNSELOR_TITLE } from "@/lib/counselors";
import { parsePhotoDataUrl } from "@/lib/photos";

const createSchema = z.object({
  name: z.string().min(1),
  fullName: z.string().optional(),
  title: z.string().trim().min(1).max(100).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  color: z.string().optional(),
  photo: z.string().max(700_000).optional(), // data URL from the browser-side resizer
  lineUserId: z.string().optional(),
});

export async function GET() {
  const counselors = await prisma.counselor.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      partner: { select: { id: true, name: true } },
      _count: {
        select: { slots: true },
      },
    },
  });
  return NextResponse.json({
    counselors: counselors.map((c) => ({ ...c, photoUrl: effectivePhotoUrl(c), hasUpload: Boolean(c.photoUpdatedAt) })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const { photo, ...fields } = parsed.data;
  const decoded = photo ? parsePhotoDataUrl(photo) : null;
  if (photo && !decoded) {
    return NextResponse.json(
      { error: "bad_photo", message: "รูปไม่ถูกต้องหรือใหญ่เกินไป" },
      { status: 400 }
    );
  }
  const counselor = await prisma.counselor.create({
    data: {
      ...fields,
      title: fields.title ?? DEFAULT_COUNSELOR_TITLE,
      ...(decoded
        ? {
            photoUpdatedAt: new Date(),
            photo: { create: { data: new Uint8Array(decoded.data), contentType: decoded.contentType } },
          }
        : {}),
    },
  });
  return NextResponse.json({ counselor }, { status: 201 });
}
