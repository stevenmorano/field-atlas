-- Keep administrator map-level holds authoritative for every owner sharing transition.
-- This replaces only the owner unpublish function and preserves all maps, revisions,
-- publications, reports, assets, and audit history.

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
  if locked_map.publication_hold then
    raise exception 'This map is on a moderation hold and cannot be made private until an administrator restores it.' using errcode = '42501';
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

revoke all on function public.unpublish_map(uuid, uuid) from public, anon;
grant execute on function public.unpublish_map(uuid, uuid) to authenticated;
