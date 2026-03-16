
-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cvr text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'active',
  dpa_accepted_at timestamptz,
  dpa_version text default '1.0',
  deletion_requested_at timestamptz,
  created_at timestamptz default now()
);

-- MEMBERS
create table public.members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  name text not null,
  email text not null,
  marketing_consent boolean default false,
  marketing_consent_at timestamptz,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- MEETINGS
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  meeting_date timestamptz,
  location text,
  status text default 'draft',
  created_by uuid references public.members(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- AGENDA_ITEMS
create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- MINUTES
create table public.minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  content text not null default '',
  created_by uuid references public.members(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- APPROVALS
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  member_id uuid references public.members(id),
  approved_at timestamptz default now(),
  ip_address text,
  token text unique,
  token_expires_at timestamptz
);

-- ACTION_ITEMS
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  agenda_item_id uuid references public.agenda_items(id) on delete set null,
  title text not null,
  assigned_to uuid references public.members(id),
  due_date date,
  status text default 'open',
  created_at timestamptz default now()
);

-- DOCUMENTS
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  storage_path text not null,
  file_type text,
  file_size_bytes integer,
  category text default 'other',
  retention_years integer default 10,
  uploaded_by uuid references public.members(id),
  created_at timestamptz default now()
);

-- AUDIT_EVENTS
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- OWNERSHIP_TRANSFERS
create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  from_member_id uuid references public.members(id),
  to_email text not null,
  token text unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.members enable row level security;
alter table public.meetings enable row level security;
alter table public.agenda_items enable row level security;
alter table public.minutes enable row level security;
alter table public.approvals enable row level security;
alter table public.action_items enable row level security;
alter table public.documents enable row level security;
alter table public.audit_events enable row level security;
alter table public.ownership_transfers enable row level security;

-- Helper function
create or replace function public.user_is_org_member(_org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from members
    where members.org_id = _org_id
    and members.user_id = auth.uid()
  );
$$;

-- RLS policies for organizations
create policy "Medlemmer kan se egne organisationer" on public.organizations
  for select using (public.user_is_org_member(id));
create policy "Medlemmer kan opdatere egne organisationer" on public.organizations
  for update using (public.user_is_org_member(id));

-- RLS policies for members
create policy "Medlemmer kan se org medlemmer" on public.members
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan indsætte i org" on public.members
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org medlemmer" on public.members
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org medlemmer" on public.members
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for meetings
create policy "Medlemmer kan se org møder" on public.meetings
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org møder" on public.meetings
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org møder" on public.meetings
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org møder" on public.meetings
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for agenda_items
create policy "Medlemmer kan se org dagsordenspunkter" on public.agenda_items
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org dagsordenspunkter" on public.agenda_items
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org dagsordenspunkter" on public.agenda_items
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org dagsordenspunkter" on public.agenda_items
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for minutes
create policy "Medlemmer kan se org referater" on public.minutes
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org referater" on public.minutes
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org referater" on public.minutes
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org referater" on public.minutes
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for approvals
create policy "Medlemmer kan se org godkendelser" on public.approvals
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org godkendelser" on public.approvals
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org godkendelser" on public.approvals
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org godkendelser" on public.approvals
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for action_items
create policy "Medlemmer kan se org handlingspunkter" on public.action_items
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org handlingspunkter" on public.action_items
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org handlingspunkter" on public.action_items
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org handlingspunkter" on public.action_items
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for documents
create policy "Medlemmer kan se org dokumenter" on public.documents
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org dokumenter" on public.documents
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org dokumenter" on public.documents
  for update using (public.user_is_org_member(org_id));
create policy "Medlemmer kan slette org dokumenter" on public.documents
  for delete using (public.user_is_org_member(org_id));

-- RLS policies for audit_events
create policy "Medlemmer kan se org hændelser" on public.audit_events
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org hændelser" on public.audit_events
  for insert with check (public.user_is_org_member(org_id));

-- RLS policies for ownership_transfers
create policy "Medlemmer kan se org overdragelser" on public.ownership_transfers
  for select using (public.user_is_org_member(org_id));
create policy "Medlemmer kan oprette org overdragelser" on public.ownership_transfers
  for insert with check (public.user_is_org_member(org_id));
create policy "Medlemmer kan opdatere org overdragelser" on public.ownership_transfers
  for update using (public.user_is_org_member(org_id));

-- Storage bucket for documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

create policy "Adgang til dokumenter via org" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select org_id from public.members where user_id = auth.uid()
    )
  );

create policy "Upload dokumenter via org" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select org_id from public.members where user_id = auth.uid()
    )
  );

create policy "Slet dokumenter via org" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select org_id from public.members where user_id = auth.uid()
    )
  );
