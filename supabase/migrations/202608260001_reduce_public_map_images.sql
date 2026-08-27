-- Keep private source images at their original resolution while publishing a
-- bounded public derivative. Existing publications remain unchanged.

alter table public.map_publications
  add column if not exists public_anchors jsonb;

-- The public image may be smaller than the private source, so its image-space
-- anchor coordinates are stored alongside the immutable publication snapshot.
create function public.publish_map_revision_v2(
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
  p_public_anchors jsonb,
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
  result record;
  source_anchor_total integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_public_anchors) <> 'array' then
    raise exception 'Public anchor coordinates are invalid.' using errcode = '22023';
  end if;

  select jsonb_array_length(revision.anchors)
  into source_anchor_total
  from public.map_revisions revision
  where revision.id = p_revision_id and revision.map_id = p_map_id;
  if source_anchor_total is null or source_anchor_total <> jsonb_array_length(p_public_anchors) then
    raise exception 'Public anchor coordinates do not match the map revision.' using errcode = '22023';
  end if;

  select * into result
  from public.publish_map_revision(
    p_map_id,
    p_revision_id,
    p_public_asset_id,
    p_high_quality_object_key,
    p_thumbnail_object_key,
    p_mime_type,
    p_high_quality_byte_size,
    p_thumbnail_byte_size,
    p_sha256,
    p_width,
    p_height,
    p_visibility,
    p_rights_basis,
    p_source_url,
    p_license_name,
    p_attribution,
    p_coverage_center_lat,
    p_coverage_center_lng,
    p_coverage_radius_m,
    p_share_token_hash,
    p_idempotency_key,
    p_expected_publication_id
  );

  update public.map_publications publication
  set public_anchors = p_public_anchors
  where publication.id = result.publication_id
    and publication.map_id = p_map_id
    and publication.revision_id = p_revision_id
    and publication.public_asset_id = p_public_asset_id
    and publication.public_anchors is null;

  return query select result.publication_id, result.publication_number, result.moderation_status;
end;
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
    'anchors', coalesce(publication.public_anchors, revision.anchors),
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

revoke all on function public.publish_map_revision_v2(
  uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer,
  jsonb, text, text, text, text, text, double precision, double precision,
  double precision, text, uuid, uuid
) from public, anon;
grant execute on function public.publish_map_revision_v2(
  uuid, uuid, uuid, text, text, text, bigint, bigint, text, integer, integer,
  jsonb, text, text, text, text, text, double precision, double precision,
  double precision, text, uuid, uuid
) to authenticated;
