import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const importSchema = z.object({
  // One counselor per line: ชื่อ[,ตำแหน่ง/ความถนัด[,ลิงก์รูป]]
  text: z.string().min(1).max(100_000),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const rows = parsed.data.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, title, photoUrl] = line.split(",").map((cell) => cell.trim());
      return { name, title: title || null, photoUrl: photoUrl || null };
    })
    .filter((row) => row.name);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "nothing_to_import", message: "ไม่พบรายชื่อที่นำเข้าได้" },
      { status: 400 }
    );
  }

  const existing = await prisma.counselor.findMany({ select: { name: true } });
  const taken = new Set(existing.map((c) => c.name.toLowerCase()));

  const toCreate: typeof rows = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (taken.has(key)) {
      skipped.push(row.name);
      continue;
    }
    taken.add(key);
    toCreate.push(row);
  }

  // Create one by one so createdAt order matches the pasted order (used for pair rotation).
  for (const row of toCreate) {
    await prisma.counselor.create({ data: row });
  }

  return NextResponse.json({ created: toCreate.length, skipped }, { status: 201 });
}
