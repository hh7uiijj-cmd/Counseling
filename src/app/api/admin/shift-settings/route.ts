import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getShiftSettings, saveShiftSettings } from "@/lib/settings";

const schema = z.object({
  maxShiftsPerPerson: z.number().int().min(0).max(100),
  changeCutoffHours: z.number().int().min(0).max(24 * 30),
});

export async function GET() {
  return NextResponse.json({ settings: await getShiftSettings() });
}

export async function PUT(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  await saveShiftSettings(parsed.data);
  return NextResponse.json({ settings: parsed.data });
}
