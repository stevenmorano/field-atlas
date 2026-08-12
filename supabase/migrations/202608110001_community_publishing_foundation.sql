-- Field Atlas community publishing foundation.
-- Additive to the private cloud schema: existing maps, revisions, and images are preserved.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_seed text not null,
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
  )
);

create unique index profiles_username_lower_idx on public.profiles(lower(username));

create table public.site_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table public.map_public_assets (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_asset_id uuid not null references public.map_assets(id) on delete restrict,
  high_quality_object_key text not null unique,
  thumbnail_object_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  high_quality_byte_size bigint not null check (high_quality_byte_size > 0),
  thumbnail_byte_size bigint not null check (thumbnail_byte_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  width integer not null check (width > 0 and width <= 20000),
  height integer not null check (height > 0 and height <= 20000),
  status text not null default 'ready' check (status in ('ready', 'failed')),
  created_at timestamptz not null default now()
);

create table public.map_publications (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  revision_id uuid not null references public.map_revisions(id) on delete restrict,
  public_asset_id uuid not null references public.map_public_assets(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  publication_number bigint not null check (publication_number > 0),
  visibility text not null check (visibility in ('public', 'unlisted')),
  moderation_status text not null default 'needs_review'
    check (moderation_status in ('needs_review', 'admin_checked', 'changes_requested', 'hidden')),
  title text not null check (char_length(title) between 1 and 500),
  description text not null default '' check (char_length(description) <= 100000),
  place_name text not null default '' check (char_length(place_name) <= 500),
  subject text not null check (char_length(subject) between 1 and 200),
  visual_style text not null check (char_length(visual_style) between 1 and 200),
  map_date_kind text not null check (map_date_kind in ('unknown', 'current', 'exact', 'approximate')),
  map_year integer check (map_year between -10000 and 20000),
  activities text[] not null default '{}',
  source_url text not null default '' check (char_length(source_url) <= 2000),
  rights_basis text not null check (
    rights_basis in ('own_or_authorized', 'permission', 'public_domain', 'open_license')
  ),
  license_name text not null default '' check (char_length(license_name) <= 500),
  attribution text not null default '' check (char_length(attribution) <= 2000),
  anchor_count integer not null check (anchor_count >= 2 and anchor_count <= 10000),
  coverage_center_lat double precision check (coverage_center_lat between -90 and 90),
  coverage_center_lng double precision check (coverage_center_lng between -180 and 180),
  coverage_radius_m double precision check (coverage_radius_m >= 0),
  idempotency_key uuid not null,
  published_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('owner_unpublished', 'superseded', 'account_deletion')),
  unique (map_id, publication_number),
  unique (owner_id, idempotency_key)
);

create table public.map_share_tokens (
  publication_id uuid primary key references public.map_publications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.map_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.map_publications(id) on delete cascade,
  category text not null check (
    category in ('gps_inaccurate', 'bad_quality', 'wrong_details', 'duplicate', 'copyright', 'unsafe_or_abusive', 'other')
  ),
  note text not null default '' check (char_length(note) <= 2000),
  reporter_id uuid references auth.users(id) on delete set null,
  anonymous_daily_token bytea check (
    anonymous_daily_token is null or octet_length(anonymous_daily_token) = 32
  ),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  publication_id uuid not null references public.map_publications(id) on delete cascade,
  map_id uuid not null references public.maps(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in ('published', 'unpublished', 'admin_checked', 'changes_requested', 'hidden', 'restored')
  ),
  reason text not null default '' check (char_length(reason) <= 2000),
  created_at timestamptz not null default now()
);

create table public.user_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone text not null check (milestone in ('first_public_map', 'five_maps_shared')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, milestone)
);

alter table public.maps
  add column current_publication_id uuid references public.map_publications(id) on delete set null,
  add column publication_hold boolean not null default false,
  add column publication_hold_reason text;

create index map_public_assets_owner_idx on public.map_public_assets(owner_id, created_at desc);
create index map_public_assets_source_idx on public.map_public_assets(source_asset_id);
create index map_publications_map_idx on public.map_publications(map_id, publication_number desc);
create index map_publications_revision_idx on public.map_publications(revision_id);
create index map_publications_asset_idx on public.map_publications(public_asset_id);
create index map_publications_owner_idx on public.map_publications(owner_id, published_at desc);
create index map_publications_discover_idx
  on public.map_publications(visibility, moderation_status, published_at desc)
  where ended_at is null;
create index map_publications_subject_idx
  on public.map_publications(subject, published_at desc)
  where visibility = 'public' and ended_at is null and moderation_status <> 'hidden';
create index maps_current_publication_idx
  on public.maps(current_publication_id)
  where current_publication_id is not null;
create index map_share_tokens_owner_idx on public.map_share_tokens(owner_id);
create index map_reports_publication_idx on public.map_reports(publication_id, created_at desc);
create index map_reports_open_idx on public.map_reports(created_at desc) where status = 'open';
create index map_reports_rate_limit_idx
  on public.map_reports(anonymous_daily_token, created_at desc)
  where anonymous_daily_token is not null;
create index moderation_actions_publication_idx on public.moderation_actions(publication_id, created_at desc);
create index moderation_actions_actor_idx on public.moderation_actions(actor_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.site_roles enable row level security;
alter table public.map_public_assets enable row level security;
alter table public.map_publications enable row level security;
alter table public.map_share_tokens enable row level security;
alter table public.map_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.user_milestones enable row level security;

create or replace function private.is_site_staff(candidate_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.site_roles
    where user_id = candidate_user_id and role in ('admin', 'moderator')
  );
$$;

create or replace function private.is_publication_effective(candidate_publication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.map_publications publication
    join public.maps map on map.id = publication.map_id
    where publication.id = candidate_publication_id
      and map.current_publication_id = publication.id
      and map.publication_hold = false
      and publication.ended_at is null
      and publication.moderation_status <> 'hidden'
  );
$$;

create or replace function private.can_open_publication(
  candidate_publication_id uuid,
  candidate_share_token_hash text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.map_publications publication
    where publication.id = candidate_publication_id
      and (select private.is_publication_effective(publication.id))
      and (
        publication.visibility = 'public'
        or (
          publication.visibility = 'unlisted'
          and candidate_share_token_hash ~ '^[a-f0-9]{64}$'
          and exists (
            select 1 from public.map_share_tokens token
            where token.publication_id = publication.id
              and token.revoked_at is null
              and token.token_hash = decode(candidate_share_token_hash, 'hex')
          )
        )
      )
  );
$$;

create or replace function public.ensure_field_atlas_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, username, avatar_seed)
  values (
    new.id,
    'atlas-' || left(replace(new.id::text, '-', ''), 10),
    replace(new.id::text, '-', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_field_atlas_profile on auth.users;
create trigger on_auth_user_created_field_atlas_profile
  after insert on auth.users
  for each row execute function public.ensure_field_atlas_profile();

insert into public.profiles(user_id, username, avatar_seed)
select id, 'atlas-' || left(replace(id::text, '-', ''), 10), replace(id::text, '-', '')
from auth.users
on conflict (user_id) do nothing;

-- Remove the early prototype's raw public-table access. Owners retain access;
-- public and unlisted viewers use allowlisted RPC DTOs below.
drop policy if exists maps_public_select on public.maps;
drop policy if exists revisions_public_select on public.map_revisions;
drop policy if exists assets_public_select on public.map_assets;
drop function if exists private.is_map_published(uuid);
drop function if exists private.is_asset_public(uuid);

revoke select on public.map_assets, public.maps, public.map_revisions from anon;

create policy profiles_self_select on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy site_roles_self_select on public.site_roles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy public_assets_owner_select on public.map_public_assets
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy publications_owner_select on public.map_publications
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy share_tokens_owner_select on public.map_share_tokens
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy reports_staff_select on public.map_reports
  for select to authenticated using ((select private.is_site_staff((select auth.uid()))));

create policy moderation_actions_staff_select on public.moderation_actions
  for select to authenticated using ((select private.is_site_staff((select auth.uid()))));

revoke all on public.profiles, public.site_roles, public.map_public_assets,
  public.map_publications, public.map_share_tokens, public.map_reports,
  public.moderation_actions, public.user_milestones from anon, authenticated;
grant select on public.profiles, public.site_roles, public.map_public_assets, public.map_publications,
  public.map_share_tokens, public.map_reports, public.moderation_actions to authenticated;

create or replace function public.update_public_profile(p_username text, p_bio text default '')
returns table(username text, bio text, avatar_seed text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  normalized_username text := lower(trim(p_username));
begin
  if acting_user is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if normalized_username !~ '^[a-z0-9][a-z0-9_-]{2,29}$'
    or normalized_username in ('admin', 'administrator', 'fieldatlas', 'field-atlas', 'support', 'moderator') then
    raise exception 'Choose 3-30 letters, numbers, underscores, or dashes.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_bio, '')) > 280 then
    raise exception 'Bio is too long.' using errcode = '22023';
  end if;

  update public.profiles profile
  set username = normalized_username,
      bio = coalesce(p_bio, ''),
      updated_at = now()
  where profile.user_id = acting_user;

  return query
    select profile.username, profile.bio, profile.avatar_seed
    from public.profiles profile where profile.user_id = acting_user;
exception
  when unique_violation then
    raise exception 'That username is already taken.' using errcode = '23505';
end;
$$;

create or replace function public.publish_map_revision(
  p_map_id uuid,
  p_revision_id uuid,
  p_public_asset_id uuid,
  p_high_quality_object_key text,
  p_thumbnail_object_key text,
  p_mime_type text,
  p_high_quality_byte_size bigint,
  p_thumbnail_byte_size bigint,
  p_sha256 text,
  p_width integer,
  p_height integer,
  p_visibility text,
  p_rights_basis text,
  p_source_url text,
  p_license_name text,
  p_attribution text,
  p_coverage_center_lat double precision,
  p_coverage_center_lng double precision,
  p_coverage_radius_m double precision,
  p_share_token_hash text,
  p_idempotency_key uuid,
  p_expected_publication_id uuid default null
)
returns table(publication_id uuid, publication_number bigint, moderation_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  locked_map public.maps%rowtype;
  revision public.map_revisions%rowtype;
  source_asset public.map_assets%rowtype;
  existing_publication public.map_publications%rowtype;
  new_publication_id uuid;
  next_publication_number bigint;
  metadata jsonb;
  anchor_total integer;
begin
  if acting_user is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into existing_publication
  from public.map_publications
  where owner_id = acting_user and idempotency_key = p_idempotency_key;
  if found then
    if existing_publication.map_id <> p_map_id
      or existing_publication.revision_id <> p_revision_id
      or existing_publication.visibility <> p_visibility
      or existing_publication.rights_basis <> p_rights_basis
      or existing_publication.source_url <> coalesce(nullif(trim(p_source_url), ''), coalesce((
        select candidate.metadata ->> 'source' from public.map_revisions candidate where candidate.id = p_revision_id
      ), ''))
      or existing_publication.license_name <> coalesce(p_license_name, '')
      or existing_publication.attribution <> coalesce(p_attribution, '')
      or (
        existing_publication.visibility = 'unlisted'
        and not exists (
          select 1 from public.map_share_tokens token
          where token.publication_id = existing_publication.id
            and token.revoked_at is null
            and coalesce(p_share_token_hash, '') ~ '^[a-f0-9]{64}$'
            and token.token_hash = decode(p_share_token_hash, 'hex')
        )
      ) then
      raise exception 'Publication retry ID was already used for different choices.' using errcode = '23505';
    end if;
    return query select existing_publication.id, existing_publication.publication_number,
      existing_publication.moderation_status;
    return;
  end if;

  select * into locked_map from public.maps where id = p_map_id for update;
  if not found then
    raise exception 'Map was not found.' using errcode = 'P0002';
  end if;
  if locked_map.owner_id <> acting_user then
    raise exception 'You do not own this map.' using errcode = '42501';
  end if;
  if locked_map.publication_hold then
    raise exception 'This map is on a moderation hold.' using errcode = '42501';
  end if;
  if locked_map.current_revision_id is distinct from p_revision_id then
    raise exception 'Sync the latest working revision before publishing.' using errcode = '40001';
  end if;
  if locked_map.current_publication_id is distinct from p_expected_publication_id then
    raise exception 'The published version changed. Refresh and try again.' using errcode = '40001';
  end if;

  select * into revision from public.map_revisions
  where id = p_revision_id and map_id = p_map_id and owner_id = acting_user;
  if not found then
    raise exception 'Map revision was not found.' using errcode = 'P0002';
  end if;
  select * into source_asset from public.map_assets
  where id = revision.asset_id and owner_id = acting_user and status = 'ready';
  if not found then
    raise exception 'Private source image is not ready.' using errcode = '22023';
  end if;

  metadata := revision.metadata;
  anchor_total := jsonb_array_length(revision.anchors);
  if anchor_total < 2 then
    raise exception 'Add at least two anchors before sharing.' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'unlisted')
    or p_rights_basis not in ('own_or_authorized', 'permission', 'public_domain', 'open_license')
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_width <= 0 or p_height <= 0 or p_width > 20000 or p_height > 20000
    or p_high_quality_byte_size <= 0 or p_thumbnail_byte_size <= 0 then
    raise exception 'Publication details are invalid.' using errcode = '22023';
  end if;
  if p_rights_basis = 'open_license' and trim(coalesce(p_license_name, '')) = '' then
    raise exception 'Name the open license.' using errcode = '22023';
  end if;
  if p_visibility = 'unlisted' and coalesce(p_share_token_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Unlisted link token is invalid.' using errcode = '22023';
  end if;
  if p_visibility = 'public' and p_share_token_hash is not null then
    raise exception 'Public maps do not use a share token.' using errcode = '22023';
  end if;
  if p_high_quality_object_key not like ('public/' || acting_user::text || '/' || p_public_asset_id::text || '/%')
    or p_thumbnail_object_key not like ('public/' || acting_user::text || '/' || p_public_asset_id::text || '/%') then
    raise exception 'Public image key is invalid.' using errcode = '22023';
  end if;

  insert into public.map_public_assets(
    id, owner_id, source_asset_id, high_quality_object_key, thumbnail_object_key,
    mime_type, high_quality_byte_size, thumbnail_byte_size, sha256, width, height
  ) values (
    p_public_asset_id, acting_user, source_asset.id, p_high_quality_object_key, p_thumbnail_object_key,
    p_mime_type, p_high_quality_byte_size, p_thumbnail_byte_size, p_sha256, p_width, p_height
  );

  select coalesce(max(candidate.publication_number), 0) + 1 into next_publication_number
  from public.map_publications candidate where candidate.map_id = p_map_id;

  insert into public.map_publications(
    map_id, revision_id, public_asset_id, owner_id, publication_number, visibility,
    title, description, place_name, subject, visual_style, map_date_kind, map_year,
    activities, source_url, rights_basis, license_name, attribution, anchor_count,
    coverage_center_lat, coverage_center_lng, coverage_radius_m, idempotency_key
  ) values (
    p_map_id, p_revision_id, p_public_asset_id, acting_user, next_publication_number, p_visibility,
    metadata ->> 'title', coalesce(metadata ->> 'description', ''),
    coalesce(metadata ->> 'placeName', ''), metadata ->> 'subject', metadata ->> 'visualStyle',
    metadata ->> 'mapDateKind', nullif(metadata ->> 'mapYear', '')::integer,
    coalesce(array(select jsonb_array_elements_text(metadata -> 'activities')), '{}'),
    coalesce(nullif(trim(p_source_url), ''), coalesce(metadata ->> 'source', '')),
    p_rights_basis, coalesce(p_license_name, ''), coalesce(p_attribution, ''), anchor_total,
    p_coverage_center_lat, p_coverage_center_lng, p_coverage_radius_m, p_idempotency_key
  ) returning id into new_publication_id;

  if p_visibility = 'unlisted' then
    insert into public.map_share_tokens(publication_id, owner_id, token_hash)
    values (new_publication_id, acting_user, decode(p_share_token_hash, 'hex'));
  end if;

  if locked_map.current_publication_id is not null then
    update public.map_publications
    set ended_at = now(), end_reason = 'superseded'
    where id = locked_map.current_publication_id and ended_at is null;
  end if;

  update public.maps
  set current_publication_id = new_publication_id,
      publication_status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_map_id;

  insert into public.moderation_actions(publication_id, map_id, actor_id, action)
  values (new_publication_id, p_map_id, acting_user, 'published');

  return query select new_publication_id, next_publication_number, 'needs_review'::text;
end;
$$;

create or replace function public.unpublish_map(p_map_id uuid, p_expected_publication_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  locked_map public.maps%rowtype;
begin
  if acting_user is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select * into locked_map from public.maps where id = p_map_id for update;
  if not found or locked_map.owner_id <> acting_user then
    raise exception 'Map was not found.' using errcode = 'P0002';
  end if;
  if locked_map.current_publication_id is distinct from p_expected_publication_id then
    raise exception 'The published version changed. Refresh and try again.' using errcode = '40001';
  end if;
  if locked_map.current_publication_id is null then return; end if;

  update public.map_publications set ended_at = now(), end_reason = 'owner_unpublished'
  where id = locked_map.current_publication_id and ended_at is null;
  update public.map_share_tokens set revoked_at = now()
  where publication_id = locked_map.current_publication_id and revoked_at is null;
  insert into public.moderation_actions(publication_id, map_id, actor_id, action)
  values (locked_map.current_publication_id, p_map_id, acting_user, 'unpublished');
  update public.maps set current_publication_id = null, publication_status = 'private', updated_at = now()
  where id = p_map_id;
end;
$$;

create or replace function public.list_public_maps(
  p_query text default '',
  p_subject text default null,
  p_limit integer default 24,
  p_before timestamptz default null
)
returns table(
  map_id uuid,
  publication_id uuid,
  public_asset_id uuid,
  title text,
  description text,
  place_name text,
  subject text,
  visual_style text,
  map_date_kind text,
  map_year integer,
  activities text[],
  anchor_count integer,
  published_at timestamptz,
  username text,
  admin_checked boolean,
  coverage_center_lat double precision,
  coverage_center_lng double precision,
  coverage_radius_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select publication.map_id, publication.id, publication.public_asset_id,
    publication.title, publication.description, publication.place_name, publication.subject,
    publication.visual_style, publication.map_date_kind, publication.map_year,
    publication.activities, publication.anchor_count, publication.published_at,
    profile.username, publication.moderation_status = 'admin_checked',
    publication.coverage_center_lat, publication.coverage_center_lng, publication.coverage_radius_m
  from public.map_publications publication
  join public.maps map on map.id = publication.map_id and map.current_publication_id = publication.id
  join public.profiles profile on profile.user_id = publication.owner_id
  where publication.visibility = 'public'
    and publication.ended_at is null
    and publication.moderation_status <> 'hidden'
    and map.publication_hold = false
    and (p_before is null or publication.published_at < p_before)
    and (p_subject is null or publication.subject = p_subject)
    and (
      trim(coalesce(p_query, '')) = ''
      or (publication.title || ' ' || publication.place_name || ' ' || publication.description)
        ilike '%' || trim(p_query) || '%'
    )
  order by publication.published_at desc, publication.id desc
  limit least(greatest(p_limit, 1), 24);
$$;

create or replace function public.get_public_map(
  p_map_id uuid,
  p_share_token_hash text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'mapId', publication.map_id,
    'publicationId', publication.id,
    'publicAssetId', publication.public_asset_id,
    'visibility', publication.visibility,
    'moderationStatus', publication.moderation_status,
    'adminChecked', publication.moderation_status = 'admin_checked',
    'title', publication.title,
    'description', publication.description,
    'placeName', publication.place_name,
    'subject', publication.subject,
    'visualStyle', publication.visual_style,
    'mapDateKind', publication.map_date_kind,
    'mapYear', publication.map_year,
    'activities', to_jsonb(publication.activities),
    'sourceUrl', publication.source_url,
    'licenseName', publication.license_name,
    'attribution', publication.attribution,
    'anchorCount', publication.anchor_count,
    'publishedAt', publication.published_at,
    'author', jsonb_build_object('username', profile.username, 'avatarSeed', profile.avatar_seed),
    'image', jsonb_build_object('width', asset.width, 'height', asset.height, 'mimeType', asset.mime_type),
    'anchors', revision.anchors,
    'targetZoom', revision.target_zoom,
    'basemapMode', revision.basemap_mode,
    'coverage', jsonb_build_object(
      'latitude', publication.coverage_center_lat,
      'longitude', publication.coverage_center_lng,
      'radiusMeters', publication.coverage_radius_m
    )
  )
  from public.map_publications publication
  join public.maps map on map.id = publication.map_id and map.current_publication_id = publication.id
  join public.map_revisions revision on revision.id = publication.revision_id
  join public.map_public_assets asset on asset.id = publication.public_asset_id and asset.status = 'ready'
  join public.profiles profile on profile.user_id = publication.owner_id
  where publication.map_id = p_map_id
    and (select private.can_open_publication(publication.id, p_share_token_hash));
$$;

create or replace function public.get_public_asset_delivery(
  p_public_asset_id uuid,
  p_variant text,
  p_share_token_hash text default null
)
returns table(object_key text, mime_type text, byte_size bigint, sha256 text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when p_variant = 'thumbnail' then asset.thumbnail_object_key else asset.high_quality_object_key end,
    asset.mime_type,
    case when p_variant = 'thumbnail' then asset.thumbnail_byte_size else asset.high_quality_byte_size end,
    asset.sha256
  from public.map_public_assets asset
  join public.map_publications publication on publication.public_asset_id = asset.id
  where asset.id = p_public_asset_id
    and asset.status = 'ready'
    and p_variant in ('thumbnail', 'map')
    and (select private.can_open_publication(publication.id, p_share_token_hash));
$$;

create or replace function public.submit_map_report(
  p_publication_id uuid,
  p_category text,
  p_note text,
  p_anonymous_daily_token text,
  p_share_token_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  report_id uuid;
  daily_token bytea;
  recent_count integer;
begin
  if not (select private.can_open_publication(p_publication_id, p_share_token_hash)) then
    raise exception 'Map was not found.' using errcode = 'P0002';
  end if;
  if p_category not in ('gps_inaccurate', 'bad_quality', 'wrong_details', 'duplicate', 'copyright', 'unsafe_or_abusive', 'other')
    or char_length(coalesce(p_note, '')) > 2000
    or p_anonymous_daily_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Report details are invalid.' using errcode = '22023';
  end if;
  daily_token := decode(p_anonymous_daily_token, 'hex');
  select count(*) into recent_count from public.map_reports
  where anonymous_daily_token = daily_token and created_at >= now() - interval '24 hours';
  if recent_count >= 10 then
    raise exception 'Report limit reached. Try again tomorrow.' using errcode = '54000';
  end if;
  select count(*) into recent_count from public.map_reports
  where anonymous_daily_token = daily_token and publication_id = p_publication_id
    and created_at >= now() - interval '24 hours';
  if recent_count >= 2 then
    raise exception 'You already reported this map.' using errcode = '23505';
  end if;
  insert into public.map_reports(publication_id, category, note, reporter_id, anonymous_daily_token)
  values (p_publication_id, p_category, coalesce(p_note, ''), acting_user, daily_token)
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.list_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'username', profile.username,
    'avatarSeed', profile.avatar_seed,
    'bio', profile.bio,
    'publicMapCount', count(publication.id),
    'adminCheckedCount', count(publication.id) filter (where publication.moderation_status = 'admin_checked'),
    'milestones', coalesce((
      select jsonb_agg(milestone.milestone order by milestone.awarded_at)
      from public.user_milestones milestone where milestone.user_id = profile.user_id
    ), '[]'::jsonb),
    'maps', coalesce(jsonb_agg(jsonb_build_object(
      'mapId', publication.map_id,
      'publicationId', publication.id,
      'publicAssetId', publication.public_asset_id,
      'title', publication.title,
      'placeName', publication.place_name,
      'subject', publication.subject,
      'mapYear', publication.map_year,
      'anchorCount', publication.anchor_count,
      'adminChecked', publication.moderation_status = 'admin_checked',
      'publishedAt', publication.published_at
    ) order by publication.published_at desc) filter (where publication.id is not null), '[]'::jsonb)
  )
  from public.profiles profile
  left join public.map_publications publication
    on publication.owner_id = profile.user_id
    and publication.visibility = 'public'
    and publication.ended_at is null
    and publication.moderation_status <> 'hidden'
    and (select private.is_publication_effective(publication.id))
  where profile.username = lower(trim(p_username))
  group by profile.user_id, profile.username, profile.avatar_seed, profile.bio;
$$;

create or replace function public.list_moderation_queue(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select private.is_site_staff((select auth.uid()))) then coalesce(jsonb_agg(item), '[]'::jsonb) else null end
  from (
    select jsonb_build_object(
      'publicationId', publication.id,
      'mapId', publication.map_id,
      'title', publication.title,
      'username', profile.username,
      'moderationStatus', publication.moderation_status,
      'publishedAt', publication.published_at,
      'reportCount', count(report.id) filter (where report.status = 'open'),
      'reports', coalesce(jsonb_agg(jsonb_build_object(
        'id', report.id,
        'category', report.category,
        'note', report.note,
        'createdAt', report.created_at
      ) order by report.created_at) filter (where report.id is not null and report.status = 'open'), '[]'::jsonb)
    ) as item
    from public.map_publications publication
    join public.maps map on map.current_publication_id = publication.id
    join public.profiles profile on profile.user_id = publication.owner_id
    left join public.map_reports report on report.publication_id = publication.id
    where publication.ended_at is null
      and (
        publication.moderation_status in ('needs_review', 'changes_requested', 'hidden')
        or report.status = 'open'
      )
    group by publication.id, profile.username
    order by count(report.id) filter (where report.status = 'open') desc, publication.published_at
    limit least(greatest(p_limit, 1), 50)
  ) queue;
$$;

create or replace function public.moderate_publication(
  p_publication_id uuid,
  p_action text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  publication public.map_publications%rowtype;
  checked_count bigint;
begin
  if acting_user is null or not (select private.is_site_staff(acting_user)) then
    raise exception 'Staff access is required.' using errcode = '42501';
  end if;
  if p_action not in ('admin_checked', 'changes_requested', 'hidden', 'restored')
    or char_length(coalesce(p_reason, '')) > 2000 then
    raise exception 'Moderation action is invalid.' using errcode = '22023';
  end if;
  select * into publication from public.map_publications where id = p_publication_id for update;
  if not found or publication.ended_at is not null then
    raise exception 'Publication was not found.' using errcode = 'P0002';
  end if;

  if p_action = 'hidden' then
    update public.map_publications set moderation_status = 'hidden' where id = publication.id;
    update public.maps set publication_hold = true, publication_hold_reason = coalesce(p_reason, '')
    where id = publication.map_id;
  elsif p_action = 'restored' then
    update public.map_publications set moderation_status = 'needs_review' where id = publication.id;
    update public.maps set publication_hold = false, publication_hold_reason = null
    where id = publication.map_id;
  else
    update public.map_publications set moderation_status = p_action where id = publication.id;
  end if;

  if p_action in ('admin_checked', 'changes_requested', 'hidden') then
    update public.map_reports
    set status = 'reviewed', reviewed_at = now(), reviewed_by = acting_user
    where publication_id = publication.id and status = 'open';
  end if;

  if p_action = 'admin_checked' then
    select count(*) into checked_count from public.map_publications candidate
    where candidate.owner_id = publication.owner_id
      and candidate.visibility = 'public'
      and candidate.moderation_status = 'admin_checked';
    if checked_count >= 1 then
      insert into public.user_milestones(user_id, milestone)
      values (publication.owner_id, 'first_public_map') on conflict do nothing;
    end if;
    if checked_count >= 5 then
      insert into public.user_milestones(user_id, milestone)
      values (publication.owner_id, 'five_maps_shared') on conflict do nothing;
    end if;
  end if;

  insert into public.moderation_actions(publication_id, map_id, actor_id, action, reason)
  values (publication.id, publication.map_id, acting_user, p_action, coalesce(p_reason, ''));
end;
$$;

revoke all on function public.update_public_profile(text, text) from public, anon;
revoke all on function public.publish_map_revision(uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer, text, text, text, text, text, double precision, double precision, double precision, text, uuid, uuid) from public, anon;
revoke all on function public.unpublish_map(uuid, uuid) from public, anon;
revoke all on function public.list_public_maps(text, text, integer, timestamptz) from public;
revoke all on function public.get_public_map(uuid, text) from public;
revoke all on function public.get_public_asset_delivery(uuid, text, text) from public;
revoke all on function public.submit_map_report(uuid, text, text, text, text) from public;
revoke all on function public.list_public_profile(text) from public;
revoke all on function public.list_moderation_queue(integer) from public, anon;
revoke all on function public.moderate_publication(uuid, text, text) from public, anon;
revoke all on function public.ensure_field_atlas_profile() from public, anon, authenticated;

grant execute on function public.update_public_profile(text, text) to authenticated;
grant execute on function public.publish_map_revision(uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer, text, text, text, text, text, double precision, double precision, double precision, text, uuid, uuid) to authenticated;
grant execute on function public.unpublish_map(uuid, uuid) to authenticated;
grant execute on function public.list_public_maps(text, text, integer, timestamptz) to anon, authenticated;
grant execute on function public.get_public_map(uuid, text) to anon, authenticated;
grant execute on function public.get_public_asset_delivery(uuid, text, text) to anon, authenticated;
grant execute on function public.submit_map_report(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.list_public_profile(text) to anon, authenticated;
grant execute on function public.list_moderation_queue(integer) to authenticated;
grant execute on function public.moderate_publication(uuid, text, text) to authenticated;

revoke all on function private.is_site_staff(uuid) from public;
revoke all on function private.is_publication_effective(uuid) from public;
revoke all on function private.can_open_publication(uuid, text) from public;
grant execute on function private.is_site_staff(uuid) to authenticated;
grant execute on function private.is_publication_effective(uuid) to anon, authenticated;
grant execute on function private.can_open_publication(uuid, text) to anon, authenticated;

-- Replace YOUR_AUTH_USER_UUID after applying the migration to seed the first admin:
-- insert into public.site_roles(user_id, role) values ('YOUR_AUTH_USER_UUID', 'admin');
