-- Swaps are now between two individual counselors, not pairs.
-- Any pair-era requests are meaningless under the new rules (and the feature was never released).
DELETE FROM "SwapRequest";

-- AlterTable
ALTER TABLE "SwapRequest" ADD COLUMN     "targetId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "SwapRequest_targetId_idx" ON "SwapRequest"("targetId");

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Counselor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
