-- Allow authenticated users to insert organizations (needed for signup)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to insert themselves as first member
-- Drop existing insert policy that requires org membership (chicken-egg problem)
DROP POLICY IF EXISTS "Medlemmer kan indsætte i org" ON public.members;

CREATE POLICY "Users can insert own member record"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());