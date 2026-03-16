
DO $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, plan, dpa_accepted_at, dpa_version)
  VALUES ('Hassans Forening', 'free', now(), '1.0')
  RETURNING id INTO new_org_id;

  INSERT INTO public.members (org_id, user_id, role, name, email, joined_at)
  VALUES (
    new_org_id,
    'bc0e7387-866f-4064-8abd-3404486d5c97',
    'owner',
    'Hassan',
    'almalkx94@hotmail.com',
    now()
  );
END $$;
