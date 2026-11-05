import type { Metadata } from "next";
import MeApp from "@/components/MeApp";

export const metadata: Metadata = {
  title: "ลงเวร · ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต",
};

// Read at request time so changing the env var on Railway needs no rebuild.
export const dynamic = "force-dynamic";

export default function MePage() {
  return <MeApp liffId={process.env.LIFF_ID ?? ""} />;
}
