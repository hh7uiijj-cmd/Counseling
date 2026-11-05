import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public: serves an active counselor's uploaded photo. URL carries ?v=<timestamp> so it can be cached hard. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photo = await prisma.counselorPhoto.findFirst({
    where: { counselorId: id, counselor: { active: true } },
  });
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
