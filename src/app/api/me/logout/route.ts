import { NextResponse } from "next/server";
import { destroyCounselorSession } from "@/lib/counselorSession";

export async function POST() {
  await destroyCounselorSession();
  return NextResponse.json({ ok: true });
}
