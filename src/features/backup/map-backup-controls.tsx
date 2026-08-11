"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  fieldAtlasBackupFilename,
  FieldAtlasBackupError,
} from "@/features/backup/field-atlas-package";
import {
  applyLocalFieldAtlasImport,
  createLocalFieldAtlasBackup,
  previewLocalFieldAtlasBackup,
} from "@/features/backup/local-backup-service";
import type { PreparedFieldAtlasImport } from "@/features/backup/plan-field-atlas-import";

type BackupState = "idle" | "exporting" | "verifying" | "importing";

type MapBackupControlsProps = Readonly<{
  onImportComplete: () => void;
}>;

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formattedDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function errorMessage(error: unknown) {
  if (error instanceof FieldAtlasBackupError) {
    return error.message;
  }
  return "The backup operation could not be completed. Your existing maps were not changed.";
}

export function MapBackupControls({ onImportComplete }: MapBackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<BackupState>("idle");
  const [preview, setPreview] = useState<PreparedFieldAtlasImport | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [replaceCurrentDraft, setReplaceCurrentDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (preview && !dialog.open) {
      dialog.showModal();
    } else if (!preview && dialog.open) {
      dialog.close();
    }
  }, [preview]);

  async function exportBackup() {
    setState("exporting");
    setError(null);
    setStatusMessage("Preparing your maps and checking image files…");
    try {
      const result = await createLocalFieldAtlasBackup();
      if (result.mapCount === 0 && !result.hasDraft) {
        setStatusMessage("There are no saved maps or active draft to back up yet.");
        return;
      }

      const objectUrl = URL.createObjectURL(result.blob);
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = fieldAtlasBackupFilename(result.exportedAt);
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

      const draftSummary = result.hasDraft ? " and the active draft" : "";
      setStatusMessage(
        `Backup downloaded with ${result.mapCount} ${result.mapCount === 1 ? "map" : "maps"}${draftSummary} at ${formattedDate(result.exportedAt)}.`,
      );
    } catch (caught) {
      setError(errorMessage(caught));
      setStatusMessage(null);
    } finally {
      setState("idle");
    }
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    setState("verifying");
    setError(null);
    setStatusMessage(`Checking ${file.name} without changing your maps…`);
    try {
      const prepared = await previewLocalFieldAtlasBackup(file);
      setPreviewFileName(file.name);
      setReplaceCurrentDraft(false);
      setPreview(prepared);
      setStatusMessage(null);
    } catch (caught) {
      setError(errorMessage(caught));
      setStatusMessage(null);
    } finally {
      setState("idle");
    }
  }

  function closePreview() {
    if (state === "idle") {
      setPreview(null);
      setReplaceCurrentDraft(false);
    }
  }

  async function importBackup() {
    if (!preview) {
      return;
    }
    setState("importing");
    setError(null);
    try {
      const result = await applyLocalFieldAtlasImport(preview, { replaceCurrentDraft });
      onImportComplete();
      setPreview(null);
      setReplaceCurrentDraft(false);

      const parts = [
        `${result.importedMapCount} ${result.importedMapCount === 1 ? "map" : "maps"} imported`,
      ];
      if (result.skippedMapCount > 0) {
        parts.push(`${result.skippedMapCount} already present`);
      }
      if (result.restoredDraft) {
        parts.push("active draft restored");
      } else if (preview.incomingDraft && preview.existingDraft) {
        parts.push("current draft kept");
      }
      setStatusMessage(`${parts.join(" · ")}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setState("idle");
    }
  }

  const importedMapCount = preview?.mapsToAdd.length ?? 0;
  const willRestoreDraft = preview?.incomingDraft !== null &&
    (preview?.existingDraft === null || replaceCurrentDraft);
  const hasImportWork = importedMapCount > 0 || willRestoreDraft;

  return (
    <>
      <section className="map-backup-panel" aria-labelledby="map-backup-title">
        <div className="map-backup-panel__copy">
          <p className="eyebrow">Portable safety copy</p>
          <h2 id="map-backup-title">Protect your maps</h2>
          <p>
            Download one private file containing every saved map, original image, anchor,
            detail, and the active unfinished draft.
          </p>
        </div>
        <div className="map-backup-panel__actions">
          <button
            className="button button--ink"
            type="button"
            onClick={() => void exportBackup()}
            disabled={state !== "idle"}
          >
            {state === "exporting" ? "Preparing backup…" : "Back up all maps"}
          </button>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={state !== "idle"}
          >
            {state === "verifying" ? "Checking backup…" : "Import backup"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fieldatlas,application/x-field-atlas"
            onChange={(event) => void chooseBackup(event)}
            hidden
          />
        </div>
        <small>
          The file can contain private maps. Keep it somewhere you trust. Nothing is uploaded.
        </small>
        {statusMessage ? <p className="map-backup-status" role="status">{statusMessage}</p> : null}
        {error ? <p className="map-backup-error" role="alert">{error}</p> : null}
      </section>

      <dialog
        className="map-backup-dialog"
        ref={dialogRef}
        aria-labelledby="backup-preview-title"
        aria-describedby="backup-preview-summary"
        onCancel={(event) => {
          event.preventDefault();
          closePreview();
        }}
        onClose={() => {
          if (preview && state === "idle") {
            setPreview(null);
          }
        }}
      >
        {preview ? (
          <div className="map-backup-preview">
            <header className="map-backup-preview__header">
              <div>
                <p className="eyebrow">Verified Field Atlas backup</p>
                <h2 id="backup-preview-title">Review before importing</h2>
                <p id="backup-preview-summary">
                  {previewFileName} · exported {formattedDate(preview.backup.exportedAt)}
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={closePreview}
                disabled={state !== "idle"}
                aria-label="Close backup preview"
              >
                ×
              </button>
            </header>

            <div className="map-backup-preview__body">
              <dl className="map-backup-facts">
                <div><dt>Maps</dt><dd>{preview.backup.maps.length}</dd></div>
                <div><dt>Images</dt><dd>{preview.backup.assetCount}</dd></div>
                <div><dt>Image data</dt><dd>{formatBytes(preview.backup.totalAssetBytes)}</dd></div>
                <div><dt>Draft</dt><dd>{preview.incomingDraft ? "Included" : "None"}</dd></div>
              </dl>

              <div className="map-backup-outcome" aria-label="Import outcome summary">
                <span data-outcome="new">{preview.summary.newMapCount} new</span>
                <span data-outcome="conflict">{preview.summary.conflictMapCount} kept as copies</span>
                <span data-outcome="duplicate">{preview.summary.duplicateMapCount} already here</span>
              </div>

              {preview.decisions.length > 0 ? (
                <section className="map-backup-map-list" aria-labelledby="backup-map-list-title">
                  <h3 id="backup-map-list-title">Maps in this backup</h3>
                  <ul>
                    {preview.decisions.map((decision) => (
                      <li key={decision.sourceId}>
                        <div>
                          <strong>{decision.title}</strong>
                          <small>{decision.anchorCount} {decision.anchorCount === 1 ? "anchor" : "anchors"}</small>
                        </div>
                        <span data-outcome={decision.status}>
                          {decision.status === "new"
                            ? "New"
                            : decision.status === "conflict"
                              ? "Imported copy"
                              : "Already present"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {preview.incomingDraft ? (
                <section className="map-backup-draft-choice">
                  <div>
                    <h3>Unfinished Anchor Lab draft</h3>
                    <p>
                      Backup: <strong>{preview.incomingDraft.imageName}</strong> · {preview.incomingDraft.anchors.length} anchors
                    </p>
                    {preview.existingDraft ? (
                      <p>
                        Current: <strong>{preview.existingDraft.imageName}</strong> · {preview.existingDraft.anchors.length} anchors
                      </p>
                    ) : (
                      <p>No current draft exists, so this draft will be restored.</p>
                    )}
                  </div>
                  {preview.existingDraft ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceCurrentDraft}
                        onChange={(event) => setReplaceCurrentDraft(event.target.checked)}
                      />
                      <span>
                        <strong>Replace my current draft</strong>
                        <small>Leave unchecked to keep the draft already in this browser.</small>
                      </span>
                    </label>
                  ) : null}
                </section>
              ) : null}

              <p className="map-backup-safety-note">
                Existing saved maps are never overwritten. Conflicts become separate imported copies.
              </p>
            </div>

            <footer className="map-backup-preview__footer">
              <button
                className="button button--quiet"
                type="button"
                onClick={closePreview}
                disabled={state !== "idle"}
              >
                Cancel
              </button>
              <button
                className="button button--signal"
                type="button"
                onClick={() => void importBackup()}
                disabled={state !== "idle" || !hasImportWork}
              >
                {state === "importing"
                  ? "Importing safely…"
                  : hasImportWork
                    ? `Import ${importedMapCount} ${importedMapCount === 1 ? "map" : "maps"}${willRestoreDraft ? " and draft" : ""}`
                    : "Everything is already here"}
              </button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
