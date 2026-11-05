-- AlterTable
ALTER TABLE "Counselor" ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "partnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Counselor_partnerId_key" ON "Counselor"("partnerId");

-- CreateIndex
CREATE INDEX "Slot_partnerId_date_idx" ON "Slot"("partnerId", "date");

-- AddForeignKey
ALTER TABLE "Counselor" ADD CONSTRAINT "Counselor_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Counselor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Counselor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
