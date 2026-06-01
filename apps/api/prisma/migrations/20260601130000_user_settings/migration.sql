ALTER TABLE "User"
  ADD COLUMN "travelBudgetPreference" "BudgetPreference" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "foodNotes" TEXT,
  ADD COLUMN "accessibilityNotes" TEXT,
  ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR';
