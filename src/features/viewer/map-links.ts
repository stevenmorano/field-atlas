export function compareMapHref(mapId: string, shareToken?: string | null) {
  const base = `/maps/${mapId}/compare`;
  return shareToken ? `${base}?share=${encodeURIComponent(shareToken)}` : base;
}
