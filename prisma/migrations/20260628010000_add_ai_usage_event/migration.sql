-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surface" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "userId" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_createdAt_idx" ON "AiUsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_surface_createdAt_idx" ON "AiUsageEvent"("surface", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_model_createdAt_idx" ON "AiUsageEvent"("model", "createdAt");
