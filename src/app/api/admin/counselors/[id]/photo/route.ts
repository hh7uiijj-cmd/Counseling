import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parsePhotoDataUrl } from "@/lib/photos";

const schema = z.object({ photo: z.string().max(700_000) });

/** Admin: upload/replace a counselor's photo (data URL produced by the browser-side resizer). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const decoded = parsed.success ? parsePhotoDataUrl(parsed.data.photo) : null;
  if (!decoded) {
    return NextResponse.json(
      { error: "bad_photo", message: "รูปไม่ถูกต้องหรือใหญ่เกินไป" },
      { status: 400 }
    );
  }
  if (!(await prisma.counselor.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const data = new Uint8Array(decoded.data);
  await prisma.$transaction([
    prisma.counselorPhoto.upsert({
      where: { counselorId: id },
      create: { counselorId: id, data, contentType: decoded.contentType },
      update: { data, contentType: decoded.contentType },
    }),
    prisma.counselor.update({ where: { id }, data: { photoUpdatedAt: new Date(), photoUrl: null } }),
  ]);
  return NextResponse.json({ ok: true });
}

/** Admin: remove a counselor's photo. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.$transaction([
    prisma.counselorPhoto.deleteMany({ where: { counselorId: id } }),
    prisma.counselor.updateMany({ where: { id }, data: { photoUpdatedAt: null, photoUrl: null } }),
  ]);
  return NextResponse.json({ ok: true });
}
