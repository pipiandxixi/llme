create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  source_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  layer text not null check (layer in ('core', 'cognition', 'context', 'domain', 'public_presence', 'system')),
  section_key text not null,
  title text,
  body_md text not null,
  body_text text generated always as (regexp_replace(body_md, '#+|`|\\*|\\[|\\]|\\(|\\)', '', 'g')) stored,
  stability text check (stability in ('high', 'medium', 'low')),
  last_updated date,
  source_path text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, layer, section_key)
);

create index if not exists idx_profile_sections_profile_layer
  on public.profile_sections(profile_id, layer, position, section_key);

create index if not exists idx_profile_sections_search
  on public.profile_sections
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body_text, '')));

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('entry', 'decision', 'raw')),
  external_id text,
  slug text not null,
  title text,
  body_md text not null,
  body_text text generated always as (regexp_replace(body_md, '#+|`|\\*|\\[|\\]|\\(|\\)', '', 'g')) stored,
  happened_on date,
  memory_type text,
  domains text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  confidence text check (confidence in ('high', 'medium', 'low')),
  outcome text check (outcome in ('pending', 'validated', 'invalidated')),
  source_label text,
  related_sections text[] not null default '{}'::text[],
  processing_status text not null default 'active'
    check (processing_status in ('active', 'draft', 'archived', 'pending_processing', 'processed')),
  source_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, kind, slug),
  unique (profile_id, external_id)
);

create index if not exists idx_memory_items_profile_kind_date
  on public.memory_items(profile_id, kind, happened_on desc nulls last);

create index if not exists idx_memory_items_domains
  on public.memory_items using gin (domains);

create index if not exists idx_memory_items_tags
  on public.memory_items using gin (tags);

create index if not exists idx_memory_items_search
  on public.memory_items
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body_text, '')));

create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  body_md text not null,
  body_text text generated always as (regexp_replace(body_md, '#+|`|\\*|\\[|\\]|\\(|\\)', '', 'g')) stored,
  node_type text not null default 'wiki' check (node_type in ('wiki', 'concept', 'timeline', 'framework')),
  domains text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  source_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, slug)
);

create index if not exists idx_knowledge_nodes_profile
  on public.knowledge_nodes(profile_id, node_type, slug);

create index if not exists idx_knowledge_nodes_tags
  on public.knowledge_nodes using gin (tags);

create index if not exists idx_knowledge_nodes_search
  on public.knowledge_nodes
  using gin (to_tsvector('simple', title || ' ' || coalesce(summary, '') || ' ' || coalesce(body_text, '')));

create table if not exists public.knowledge_node_sources (
  knowledge_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  memory_item_id uuid not null references public.memory_items(id) on delete cascade,
  relation text not null default 'source' check (relation in ('source', 'derived_from', 'supports', 'contradicts')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (knowledge_node_id, memory_item_id)
);

create table if not exists public.profile_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('avatar', 'attachment', 'raw_memory_file', 'export')),
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'vercel_blob', 'external')),
  bucket text,
  object_path text not null,
  public_url text,
  mime_type text,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profile_assets_profile_type
  on public.profile_assets(profile_id, asset_type, created_at desc);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  entity_table text not null check (entity_table in ('profiles', 'profile_sections', 'memory_items', 'knowledge_nodes')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'import')),
  editor text,
  snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_content_revisions_entity
  on public.content_revisions(entity_table, entity_id, created_at desc);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_profile_sections_updated_at on public.profile_sections;
create trigger trg_profile_sections_updated_at
before update on public.profile_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_memory_items_updated_at on public.memory_items;
create trigger trg_memory_items_updated_at
before update on public.memory_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_knowledge_nodes_updated_at on public.knowledge_nodes;
create trigger trg_knowledge_nodes_updated_at
before update on public.knowledge_nodes
for each row execute function public.set_updated_at();

drop trigger if exists trg_profile_assets_updated_at on public.profile_assets;
create trigger trg_profile_assets_updated_at
before update on public.profile_assets
for each row execute function public.set_updated_at();
