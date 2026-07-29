-- CreateTable
CREATE TABLE "health_score_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "riskBand" TEXT NOT NULL,
    "formulaVersion" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_score_snapshots_userId_idx" ON "health_score_snapshots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "health_score_snapshots_userId_snapshotDate_key" ON "health_score_snapshots"("userId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "health_score_snapshots" ADD CONSTRAINT "health_score_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

