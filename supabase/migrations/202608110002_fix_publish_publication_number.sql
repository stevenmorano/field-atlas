-- Fix a PL/pgSQL output-column/table-column name collision in publish_map_revision.
-- Safe to apply after 202608110001_community_publishing_foundation.sql.

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

revoke all on function public.publish_map_revision(uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer, text, text, text, text, text, double precision, double precision, double precision, text, uuid, uuid) from public, anon;
grant execute on function public.publish_map_revision(uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer, text, text, text, text, text, double precision, double precision, double precision, text, uuid, uuid) to authenticated;
