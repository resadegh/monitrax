-- AlterEnum: add ASSET to LinkedEntityType so documents/receipts can be
-- tagged to a specific asset (vehicle, electronics, etc.). Additive only
-- (no existing value removed/renamed) -> non-destructive. Runs outside a
-- transaction per PostgreSQL's ALTER TYPE ... ADD VALUE requirement.
ALTER TYPE "LinkedEntityType" ADD VALUE IF NOT EXISTS 'ASSET';
