export type ExistingCloudRevision = Readonly<{
  id: string;
  revisionNumber: number;
  contentFingerprint: string;
  createdAt: number;
}>;

export type CloudSaveDecision =
  | Readonly<{ status: "unchanged"; revision: ExistingCloudRevision }>
  | Readonly<{ status: "rate-limited"; waitMs: number }>
  | Readonly<{ status: "allow" }>;

export type CloudSyncAcknowledgement = Readonly<{
  userId: string;
  remoteRevisionId: string;
  localUpdatedAt?: number;
}>;

export function isCloudVersionAcknowledged(
  syncState: CloudSyncAcknowledgement | null | undefined,
  activeUserId: string | null,
  remoteRevisionId: string,
  localUpdatedAt: number,
) {
  return Boolean(
    syncState?.localUpdatedAt !== undefined &&
    activeUserId &&
    syncState.userId === activeUserId &&
    syncState.remoteRevisionId === remoteRevisionId &&
    syncState.localUpdatedAt === localUpdatedAt,
  );
}

export function decideCloudSave(
  currentRevision: ExistingCloudRevision | null,
  incomingFingerprint: string,
  now = Date.now(),
  minimumIntervalMs = 30_000,
): CloudSaveDecision {
  if (!currentRevision) {
    return { status: "allow" };
  }

  if (currentRevision.contentFingerprint === incomingFingerprint) {
    return { status: "unchanged", revision: currentRevision };
  }

  const elapsed = now - currentRevision.createdAt;
  if (elapsed >= 0 && elapsed < minimumIntervalMs) {
    return { status: "rate-limited", waitMs: minimumIntervalMs - elapsed };
  }

  return { status: "allow" };
}
