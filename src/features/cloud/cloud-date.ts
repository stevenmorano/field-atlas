const RELATIVE_UNITS = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
] as const;

type RelativeUnit = (typeof RELATIVE_UNITS)[number]["unit"];

export function formatCloudRelativeTime(timestamp: number, now = Date.now(), locale?: string) {
  const differenceSeconds = (timestamp - now) / 1_000;
  const absoluteDifferenceSeconds = Math.abs(differenceSeconds);
  const relativeUnit = RELATIVE_UNITS.find(({ seconds }) => absoluteDifferenceSeconds >= seconds) ?? RELATIVE_UNITS.at(-1)!;
  const value = Math.round(differenceSeconds / relativeUnit.seconds);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, relativeUnit.unit as RelativeUnit);
}

export function formatCloudUpdatedAt(timestamp: number, now = Date.now(), locale?: string) {
  const exactTimestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
  return `${exactTimestamp} · ${formatCloudRelativeTime(timestamp, now, locale)}`;
}
