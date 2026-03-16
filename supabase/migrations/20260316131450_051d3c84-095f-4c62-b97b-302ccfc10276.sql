
-- Extend organizations with contact info
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS adresse text,
ADD COLUMN IF NOT EXISTS postnummer text,
ADD COLUMN IF NOT EXISTS by text,
ADD COLUMN IF NOT EXISTS telefon text,
ADD COLUMN IF NOT EXISTS kontakt_email text;

-- Extend members with personal info
ALTER TABLE members
ADD COLUMN IF NOT EXISTS telefon text,
ADD COLUMN IF NOT EXISTS adresse text,
ADD COLUMN IF NOT EXISTS postnummer text,
ADD COLUMN IF NOT EXISTS by text,
ADD COLUMN IF NOT EXISTS foedselsdato date,
ADD COLUMN IF NOT EXISTS email_bekraeftet boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invitation_token text UNIQUE,
ADD COLUMN IF NOT EXISTS invitation_token_expires_at timestamptz;

-- Allow public read of members by invitation_token (for invitation acceptance page)
CREATE POLICY "Anyone can read member by invitation_token"
ON members FOR SELECT
TO anon
USING (invitation_token IS NOT NULL);

-- Allow anon to update member when accepting invitation
CREATE POLICY "Anon can update member by invitation_token"
ON members FOR UPDATE
TO anon
USING (invitation_token IS NOT NULL)
WITH CHECK (invitation_token IS NOT NULL);
