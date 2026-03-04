-- Add admin billing access override so internal team can keep access active during one-off billing adjustments

ALTER TABLE "Agent"
ADD COLUMN IF NOT EXISTS "billingAccessOverride" BOOLEAN NOT NULL DEFAULT false;
