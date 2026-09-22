import { NextResponse } from "next/server";
import { isLineConfigured, pushMessageToGroup } from "@/lib/line";

export async function POST() {
  if (!isLineConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID ใน environment variables",
      },
      { status: 400 }
    );
  }

  const result = await pushMessageToGroup([
    {
      type: "text",
      text: "ทดสอบการแจ้งเตือนจากระบบห้องให้คำปรึกษา ✅ หากเห็นข้อความนี้แสดงว่าตั้งค่าเรียบร้อยแล้ว",
    },
  ]);

  if (!result.ok) {
    return NextResponse.json(
      { error: "line_api_error", detail: result },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
