-- Staff (บุคลากร) can book too: they give a free-text department instead of year/faculty/major.
-- Idempotent so it is safe to paste into the Supabase SQL editor.
DO $$ BEGIN
  CREATE TYPE "ClientType" AS ENUM ('STUDENT', 'STAFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "clientType" "ClientType" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ALTER COLUMN "yearLevel" DROP NOT NULL,
  ALTER COLUMN "faculty" DROP NOT NULL,
  ALTER COLUMN "major" DROP NOT NULL;
