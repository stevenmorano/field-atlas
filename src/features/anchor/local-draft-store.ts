import type { DemoBasemapMode } from "@/features/anchor/demo-basemap-style";
import type { AnchorPair } from "@/lib/georeferencing/types";
import type { TargetViewRotation } from "@/features/anchor/target-view-rotation";
import {
  ANCHOR_DRAFTS_STORE,
  openLocalDatabase,
  requestResult,
  transactionCompletion,
} from "@/lib/local-database";

const CURRENT_DRAFT_ID = "current";

export type LocalAnchorDraft = Readonly<{
  id: typeof CURRENT_DRAFT_ID;
  version: 1;
  savedAt: number;
  imageName: string;
  imageBlob: Blob;
  imageDimensions: Readonly<{ width: number; height: number }>;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  targetRotation?: TargetViewRotation;
  basemapMode: DemoBasemapMode;
  savedMapId?: string;
}>;

export async function readCurrentAnchorDraft() {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(ANCHOR_DRAFTS_STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(ANCHOR_DRAFTS_STORE).get(CURRENT_DRAFT_ID) as IDBRequest<
      LocalAnchorDraft | undefined
    >;
    const draft = await requestResult(request, "Could not read the local draft.");
    await completed;
    return draft ?? null;
  } finally {
    database.close();
  }
}

export async function writeCurrentAnchorDraft(
  draft: Omit<LocalAnchorDraft, "id" | "version">,
) {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(ANCHOR_DRAFTS_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(ANCHOR_DRAFTS_STORE).put({
      ...draft,
      id: CURRENT_DRAFT_ID,
      version: 1,
    } satisfies LocalAnchorDraft);
    await completed;
  } finally {
    database.close();
  }
}

export async function deleteCurrentAnchorDraft() {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(ANCHOR_DRAFTS_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(ANCHOR_DRAFTS_STORE).delete(CURRENT_DRAFT_ID);
    await completed;
  } finally {
    database.close();
  }
}
