ALTER TABLE orders ADD COLUMN direct_mail_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN direct_mail_consented_at INTEGER;
ALTER TABLE orders ADD COLUMN direct_mail_consent_version TEXT;
