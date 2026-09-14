-- Public catalog metadata for the delivered image dimensions.
-- This is additive: the existing public catalog function and all publications remain unchanged.

create function public.list_public_maps_v2(
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
  coverage_radius_m double precision,
  image_width integer,
  image_height integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    publication.map_id,
    publication.id,
    publication.public_asset_id,
    publication.title,
    publication.description,
    publication.place_name,
    publication.subject,
    publication.visual_style,
    publication.map_date_kind,
    publication.map_year,
    publication.activities,
    publication.anchor_count,
    publication.published_at,
    profile.username,
    publication.moderation_status = 'admin_checked',
    publication.coverage_center_lat,
    publication.coverage_center_lng,
    publication.coverage_radius_m,
    asset.width,
    asset.height
  from public.map_publications publication
  join public.maps map
    on map.id = publication.map_id
    and map.current_publication_id = publication.id
  join public.profiles profile
    on profile.user_id = publication.owner_id
  join public.map_public_assets asset
    on asset.id = publication.public_asset_id
    and asset.status = 'ready'
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
$function$;

revoke execute on function public.list_public_maps_v2(text, text, integer, timestamptz) from public;
grant execute on function public.list_public_maps_v2(text, text, integer, timestamptz) to anon, authenticated;
