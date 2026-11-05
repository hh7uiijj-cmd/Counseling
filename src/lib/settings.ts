import { prisma } from "@/lib/prisma";

export type ShiftSettings = {
  /** Max upcoming shifts one pair may hold at once. 0 = unlimited. */
  maxShiftsPerPair: number;
  /** Claimed shifts can't be released or swapped within this many hours of starting. 0 = no cutoff. */
  changeCutoffHours: number;
};

const DEFAULTS: ShiftSettings = { maxShiftsPerPair: 2, changeCutoffHours: 24 };

function toInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export async function getShiftSettings(): Promise<ShiftSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["maxShiftsPerPair", "changeCutoffHours"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    maxShiftsPerPair: toInt(map.get("maxShiftsPerPair"), DEFAULTS.maxShiftsPerPair),
    changeCutoffHours: toInt(map.get("changeCutoffHours"), DEFAULTS.changeCutoffHours),
  };
}

export async function saveShiftSettings(settings: ShiftSettings) {
  await prisma.$transaction(
    (Object.entries(settings) as [keyof ShiftSettings, number][]).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    )
  );
}
