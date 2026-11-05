-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Slot" DROP CONSTRAINT "Slot_counselorId_fkey";

-- AlterTable
ALTER TABLE "Slot" ALTER COLUMN "counselorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "fromSlotId" TEXT NOT NULL,
    "toSlotId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwapRequest_fromSlotId_idx" ON "SwapRequest"("fromSlotId");

-- CreateIndex
CREATE INDEX "SwapRequest_toSlotId_idx" ON "SwapRequest"("toSlotId");

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "Counselor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_fromSlotId_fkey" FOREIGN KEY ("fromSlotId") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_toSlotId_fkey" FOREIGN KEY ("toSlotId") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Counselor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
