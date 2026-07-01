create table if not exists public.content_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_memory_item_id uuid references public.memory_items(id) on delete set null,
  target_type text not null check (target_type in ('memory_item', 'profile_section')),
  action text not null check (action in ('create', 'update')),
  layer text check (layer in ('core', 'cognition', 'context', 'domain')),
  section_key text,
  memory_kind text check (memory_kind in ('entry', 'decision')),
  slug text,
  title text,
  proposed_body_md text not null,
  proposed_metadata jsonb not null default '{}'::jsonb,
  previous_body_md text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_content_proposals_profile_status
  on public.content_proposals(profile_id, status, created_at desc);

alter table public.content_proposals enable row level security;
