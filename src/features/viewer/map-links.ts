export function compareMapHref(mapId: string, shareToken?: string | null, publicView = false) {
  const base = `/maps/${mapId}/compare`;
  if (shareToken) return `${base}?share=${encodeURIComponent(shareToken)}`;
  return publicView ? `${base}?public=1` : base;
}

export function publicMapHref(mapId: string, shareToken?: string | null) {
  const base = `/maps/${mapId}`;
  return shareToken ? `${base}?share=${encodeURIComponent(shareToken)}` : `${base}?public=1`;
}
