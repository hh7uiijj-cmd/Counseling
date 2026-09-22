import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`Created admin user "${username}" with password "${password}"`);
    console.log("Please log in and consider rotating this password.");
  } else {
    console.log(`Admin user "${username}" already exists, skipping.`);
  }

  const counselorCount = await prisma.counselor.count();
  if (counselorCount === 0) {
    await prisma.counselor.createMany({
      data: [
        {
          name: "อ.สมหญิง ใจดี",
          title: "นักจิตวิทยาการปรึกษา",
          color: "#2563eb",
        },
        {
          name: "อ.ประเสริฐ มั่นคง",
          title: "นักแนะแนวการศึกษา",
          color: "#16a34a",
        },
      ],
    });
    console.log("Seeded sample counselors.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
