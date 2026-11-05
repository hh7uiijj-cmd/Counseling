import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  COUNSELOR_COOKIE_NAME,
  createCounselorToken,
  verifyCounselorToken,
} from "@/lib/auth";

export async function createCounselorSession(counselorId: string) {
  const token = await createCounselorToken(counselorId);
  const cookieStore = await cookies();
  cookieStore.set(COUNSELOR_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroyCounselorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COUNSELOR_COOKIE_NAME);
}

/** The signed-in, active counselor (with partner), or null. */
export async function getSessionCounselor() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COUNSELOR_COOKIE_NAME)?.value;
  if (!token) return null;
  const counselorId = await verifyCounselorToken(token);
  if (!counselorId) return null;
  const counselor = await prisma.counselor.findUnique({
    where: { id: counselorId },
    include: { partner: true },
  });
  return counselor && counselor.active ? counselor : null;
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
