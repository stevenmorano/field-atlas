create schema if not exists private;

create table public.map_assets (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_key text not null unique,
  original_file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maps (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  publication_status text not null default 'private'
    check (publication_status in ('private', 'draft', 'pending_review', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.map_revisions (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  parent_revision_id uuid references public.map_revisions(id) on delete set null,
  asset_id uuid not null references public.map_assets(id) on delete restrict,
  metadata jsonb not null,
  anchors jsonb not null check (jsonb_typeof(anchors) = 'array'),
  target_zoom double precision not null check (target_zoom > 0 and target_zoom <= 32),
  basemap_mode text not null check (basemap_mode in ('street', 'satellite', 'hybrid')),
  client_updated_at timestamptz not null,
  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  is_conflict boolean not null default false,
  created_at timestamptz not null default now(),
  unique (map_id, revision_number),
  unique (map_id, content_fingerprint)
);

alter table public.maps
  add column current_revision_id uuid references public.map_revisions(id) on delete set null;

create index map_assets_owner_id_idx on public.map_assets(owner_id);
create index map_assets_owner_sha_idx on public.map_assets(owner_id, sha256);
create index maps_owner_updated_idx on public.maps(owner_id, updated_at desc);
create index maps_public_updated_idx on public.maps(updated_at desc)
  where publication_status = 'published';
create index map_revisions_map_id_idx on public.map_revisions(map_id);
create index map_revisions_owner_id_idx on public.map_revisions(owner_id);
create index map_revisions_asset_id_idx on public.map_revisions(asset_id);
create index map_revisions_parent_id_idx on public.map_revisions(parent_revision_id);

alter table public.map_assets enable row level security;
alter table public.maps enable row level security;
alter table public.map_revisions enable row level security;

create or replace function private.is_map_published(candidate_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.maps
    where id = candidate_map_id
      and publication_status = 'published'
  );
$$;

create or replace function private.is_asset_public(candidate_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.maps
    join public.map_revisions
      on map_revisions.id = maps.current_revision_id
    where maps.publication_status = 'published'
      and map_revisions.asset_id = candidate_asset_id
  );
$$;

create policy maps_owner_select on public.maps
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy maps_public_select on public.maps
  for select to anon, authenticated
  using (publication_status = 'published');

create policy revisions_owner_select on public.map_revisions
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy revisions_public_select on public.map_revisions
  for select to anon, authenticated
  using ((select private.is_map_published(map_id)));

create policy assets_owner_select on public.map_assets
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy assets_public_select on public.map_assets
  for select to anon, authenticated
  using ((select private.is_asset_public(id)));

revoke all on public.map_assets, public.maps, public.map_revisions from anon, authenticated;
grant select on public.map_assets, public.maps, public.map_revisions to anon, authenticated;

create or replace function public.prepare_map_asset(
  p_asset_id uuid,
  p_object_key text,
  p_original_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_width integer,
  p_height integer
)
returns table(asset_id uuid, object_key text, asset_status text, needs_upload boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  existing_asset public.map_assets%rowtype;
begin
  if acting_user is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_object_key not like (acting_user::text || '/%') then
    raise exception 'Invalid object key.' using errcode = '22023';
  end if;

  if p_original_file_name is null or length(p_original_file_name) < 1 or length(p_original_file_name) > 500 then
    raise exception 'Invalid file name.' using errcode = '22023';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') then
    raise exception 'Unsupported image type.' using errcode = '22023';
  end if;

  if p_byte_size <= 0 or p_byte_size > 104857600 or p_width <= 0 or p_height <= 0 then
    raise exception 'Invalid image size.' using errcode = '22023';
  end if;

  if p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid image checksum.' using errcode = '22023';
  end if;

  select * into existing_asset
  from public.map_assets
  where owner_id = acting_user
    and sha256 = p_sha256
    and status = 'ready'
  order by created_at
  limit 1;

  if found then
    return query select existing_asset.id, existing_asset.object_key, existing_asset.status, false;
    return;
  end if;

  insert into public.map_assets (
    id, owner_id, object_key, original_file_name, mime_type,
    byte_size, sha256, width, height, status
  ) values (
    p_asset_id, acting_user, p_object_key, p_original_file_name, p_mime_type,
    p_byte_size, p_sha256, p_width, p_height, 'pending'
  )
  on conflict (id) do nothing;

  select * into existing_asset
  from public.map_assets
  where id = p_asset_id and owner_id = acting_user;

  if not found
    or existing_asset.object_key <> p_object_key
    or existing_asset.sha256 <> p_sha256
    or existing_asset.byte_size <> p_byte_size
    or existing_asset.mime_type <> p_mime_type then
    raise exception 'Asset ID is already in use.' using errcode = '23505';
  end if;

  return query select existing_asset.id, existing_asset.object_key, existing_asset.status, true;
end;
$$;

create or replace function public.complete_map_asset(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
begin
  if acting_user is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.map_assets
  set status = 'ready', updated_at = now()
  where id = p_asset_id and owner_id = acting_user;

  if not found then
    raise exception 'Asset was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.sync_map_revision(
  p_map_id uuid,
  p_asset_id uuid,
  p_metadata jsonb,
  p_anchors jsonb,
  p_target_zoom double precision,
  p_basemap_mode text,
  p_client_updated_at timestamptz,
  p_content_fingerprint text,
  p_base_revision_id uuid default null
)
returns table(sync_status text, map_id uuid, revision_id uuid, current_revision_id uuid, revision_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  existing_owner uuid;
  existing_status text;
  existing_current uuid;
  existing_revision public.map_revisions%rowtype;
  next_revision_number bigint;
  new_revision_id uuid;
  desired_status text;
  conflict_state boolean;
begin
  if acting_user is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_metadata) <> 'object' or jsonb_typeof(p_anchors) <> 'array' then
    raise exception 'Invalid map payload.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_anchors) > 10000
    or p_target_zoom <= 0 or p_target_zoom > 32
    or p_basemap_mode not in ('street', 'satellite', 'hybrid')
    or p_content_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid map content.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.map_assets
    where id = p_asset_id and owner_id = acting_user and status = 'ready'
  ) then
    raise exception 'The uploaded image is not ready.' using errcode = '22023';
  end if;

  desired_status := case
    when p_metadata ->> 'visibility' = 'public-ready' then 'draft'
    else 'private'
  end;

  insert into public.maps (id, owner_id, publication_status)
  values (p_map_id, acting_user, desired_status)
  on conflict (id) do nothing;

  select owner_id, publication_status, maps.current_revision_id
    into existing_owner, existing_status, existing_current
  from public.maps
  where id = p_map_id
  for update;

  if existing_owner is distinct from acting_user then
    raise exception 'Map ID is already owned by another account.' using errcode = '42501';
  end if;

  select * into existing_revision
  from public.map_revisions
  where map_revisions.map_id = p_map_id
    and content_fingerprint = p_content_fingerprint;

  if found then
    return query select
      case when existing_revision.id = existing_current then 'unchanged' else 'conflict' end,
      p_map_id,
      existing_revision.id,
      existing_current,
      existing_revision.revision_number;
    return;
  end if;

  if p_base_revision_id is not null and not exists (
    select 1 from public.map_revisions
    where id = p_base_revision_id and map_revisions.map_id = p_map_id
  ) then
    raise exception 'Base revision does not belong to this map.' using errcode = '22023';
  end if;

  conflict_state := existing_current is not null
    and p_base_revision_id is distinct from existing_current;

  select coalesce(max(map_revisions.revision_number), 0) + 1
    into next_revision_number
  from public.map_revisions
  where map_revisions.map_id = p_map_id;

  insert into public.map_revisions (
    map_id, owner_id, revision_number, parent_revision_id, asset_id,
    metadata, anchors, target_zoom, basemap_mode, client_updated_at,
    content_fingerprint, is_conflict
  ) values (
    p_map_id, acting_user, next_revision_number, p_base_revision_id, p_asset_id,
    p_metadata, p_anchors, p_target_zoom, p_basemap_mode, p_client_updated_at,
    p_content_fingerprint, conflict_state
  )
  returning id into new_revision_id;

  if not conflict_state then
    update public.maps
    set current_revision_id = new_revision_id,
        publication_status = case
          when existing_status in ('pending_review', 'published', 'rejected') then existing_status
          else desired_status
        end,
        updated_at = now()
    where id = p_map_id;
    existing_current := new_revision_id;
  end if;

  return query select
    case when conflict_state then 'conflict' else 'synced' end,
    p_map_id,
    new_revision_id,
    existing_current,
    next_revision_number;
end;
$$;

revoke all on function public.prepare_map_asset(uuid, text, text, text, bigint, text, integer, integer) from public, anon;
revoke all on function public.complete_map_asset(uuid) from public, anon;
revoke all on function public.sync_map_revision(uuid, uuid, jsonb, jsonb, double precision, text, timestamptz, text, uuid) from public, anon;

grant execute on function public.prepare_map_asset(uuid, text, text, text, bigint, text, integer, integer) to authenticated;
grant execute on function public.complete_map_asset(uuid) to authenticated;
grant execute on function public.sync_map_revision(uuid, uuid, jsonb, jsonb, double precision, text, timestamptz, text, uuid) to authenticated;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_map_published(uuid) to anon, authenticated;
grant execute on function private.is_asset_public(uuid) to anon, authenticated;
