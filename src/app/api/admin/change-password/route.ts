import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" },
      { status: 400 }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  if (!admin || !(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return NextResponse.json(
      { error: "invalid_current_password", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
