-- MON-053: one-off income was inexpressible (stored as MONTHLY, annualised ×12
-- into the tax base). Mirrors Expense.isRecurring. Additive + default-backfilled:
-- every existing row keeps today's behaviour (recurring) — no reclassification.
-- NOTE: model Income is @@map("income") — the table name is lowercase.
ALTER TABLE "income" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT true;
