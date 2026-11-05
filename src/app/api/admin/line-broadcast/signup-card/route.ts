import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSignupFlexMessage, isLineConfigured, pushMessageToGroup } from "@/lib/line";

const schema = z.object({ note: z.string().trim().max(200).optional() });

/** Post the "shift sign-up is open" card (with a button to the LIFF sign-up page) to the LINE group. */
export async function POST(request: NextRequest) {
  if (!isLineConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID" },
      { status: 400 }
    );
  }
  const liffId = process.env.LIFF_ID;
  if (!liffId) {
    return NextResponse.json(
      { error: "no_liff", message: "ยังไม่ได้ตั้งค่า LIFF_ID ใน Vercel" },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const note = parsed.success ? parsed.data.note || undefined : undefined;

  const result = await pushMessageToGroup([
    buildSignupFlexMessage({ signupUrl: `https://liff.line.me/${liffId}`, note }),
  ]);
  if (!result.ok) {
    return NextResponse.json(
      { error: "line_api_error", message: "ส่งไม่สำเร็จ กรุณาตรวจสอบ LINE_GROUP_ID และ token", detail: result },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
