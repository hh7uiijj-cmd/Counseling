-- AlterTable
ALTER TABLE "Counselor" ADD COLUMN "fullName" TEXT,
ADD COLUMN "photoUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CounselorPhoto" (
    "counselorId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounselorPhoto_pkey" PRIMARY KEY ("counselorId")
);

-- AddForeignKey
ALTER TABLE "CounselorPhoto" ADD CONSTRAINT "CounselorPhoto_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "Counselor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
