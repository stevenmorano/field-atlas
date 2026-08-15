"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  MAP_ACTIVITY_OPTIONS,
  MAP_STYLE_OPTIONS,
  MAP_SUBJECT_OPTIONS,
  type MapDateKind,
  type SavedMapMetadata,
} from "@/features/maps/saved-map-types";

type MapMetadataDialogProps = Readonly<{
  open: boolean;
  initialMetadata: SavedMapMetadata;
  anchorCount: number;
  imageName: string;
  saving: boolean;
  saveError: string | null;
  onDismiss: () => void;
  onSave: (metadata: SavedMapMetadata) => Promise<void>;
}>;

const MAX_MAP_YEAR = new Date().getFullYear() + 10;

export function MapMetadataDialog({
  open,
  initialMetadata,
  anchorCount,
  imageName,
  saving,
  saveError,
  onDismiss,
  onSave,
}: MapMetadataDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [metadata, setMetadata] = useState(initialMetadata);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      setMetadata(initialMetadata);
      setValidationError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialMetadata, open]);

  function updateField<Key extends keyof SavedMapMetadata>(
    key: Key,
    value: SavedMapMetadata[Key],
  ) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  function toggleActivity(activity: string) {
    const nextActivities = metadata.activities.includes(activity)
      ? metadata.activities.filter((item) => item !== activity)
      : [...metadata.activities, activity];
    updateField("activities", nextActivities);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = metadata.title.trim();
    if (!title) {
      setValidationError("Give this map a title before saving it.");
      return;
    }

    if (
      (metadata.mapDateKind === "exact" || metadata.mapDateKind === "approximate") &&
      (metadata.mapYear === null || metadata.mapYear < 0 || metadata.mapYear > MAX_MAP_YEAR)
    ) {
      setValidationError("Enter a valid map year.");
      return;
    }

    setValidationError(null);
    await onSave({
      ...metadata,
      title,
      description: metadata.description.trim(),
      placeName: metadata.placeName.trim(),
      source: metadata.source.trim(),
    });
  }

  return (
    <dialog
      className="map-metadata-dialog"
      ref={dialogRef}
      aria-labelledby="map-metadata-title"
      aria-describedby="map-metadata-summary"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) {
          onDismiss();
        }
      }}
      onClose={() => {
        if (open && !saving) {
          onDismiss();
        }
      }}
    >
      <form className="map-metadata-form" onSubmit={(event) => void handleSubmit(event)}>
        <header className="map-metadata-form__header">
          <div>
            <p className="eyebrow">Finish map</p>
            <h2 id="map-metadata-title">Save it to My Maps</h2>
            <p id="map-metadata-summary">
              {anchorCount} anchors · original image retained · stored on this device
            </p>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onDismiss}
            disabled={saving}
            aria-label="Close map details"
          >
            ×
          </button>
        </header>

        <div className="map-metadata-form__body">
          <div className="metadata-field metadata-field--wide">
            <label htmlFor="map-title">Map title</label>
            <input
              id="map-title"
              value={metadata.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Marshlands Conservancy Trail Map"
              autoComplete="off"
              required
              autoFocus
            />
            <small>Original file: {imageName}</small>
          </div>

          <div className="metadata-field metadata-field--wide">
            <label htmlFor="map-description">Description</label>
            <textarea
              id="map-description"
              value={metadata.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="What this map shows, its condition, or anything useful to viewers"
              rows={3}
            />
          </div>

          <div className="metadata-field">
            <label htmlFor="map-place">Place</label>
            <input
              id="map-place"
              value={metadata.placeName}
              onChange={(event) => updateField("placeName", event.target.value)}
              placeholder="Rye, New York"
              autoComplete="off"
            />
          </div>

          <div className="metadata-field">
            <label htmlFor="map-subject">Map type</label>
            <select
              id="map-subject"
              value={metadata.subject}
              onChange={(event) => updateField("subject", event.target.value)}
            >
              {MAP_SUBJECT_OPTIONS.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="metadata-field">
            <label htmlFor="map-style">Visual style</label>
            <select
              id="map-style"
              value={metadata.visualStyle}
              onChange={(event) => updateField("visualStyle", event.target.value)}
            >
              {MAP_STYLE_OPTIONS.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="metadata-date-fields">
            <div className="metadata-field">
              <label htmlFor="map-date-kind">Map date</label>
              <select
                id="map-date-kind"
                value={metadata.mapDateKind}
                onChange={(event) => {
                  const kind = event.target.value as MapDateKind;
                  setMetadata((current) => ({
                    ...current,
                    mapDateKind: kind,
                    mapYear: kind === "exact" || kind === "approximate" ? current.mapYear : null,
                  }));
                }}
              >
                <option value="unknown">Unknown</option>
                <option value="current">Current</option>
                <option value="exact">Exact year</option>
                <option value="approximate">Approximate year</option>
              </select>
            </div>
            {metadata.mapDateKind === "exact" || metadata.mapDateKind === "approximate" ? (
              <div className="metadata-field">
                <label htmlFor="map-year">Year</label>
                <input
                  id="map-year"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_MAP_YEAR}
                  value={metadata.mapYear ?? ""}
                  onChange={(event) => updateField("mapYear", event.target.value === "" ? null : Number(event.target.value))}
                  placeholder="1881"
                  required
                />
              </div>
            ) : null}
          </div>

          <fieldset className="metadata-field metadata-field--wide metadata-activities">
            <legend>Useful for</legend>
            <div>
              {MAP_ACTIVITY_OPTIONS.map((activity) => (
                <label key={activity}>
                  <input
                    type="checkbox"
                    checked={metadata.activities.includes(activity)}
                    onChange={() => toggleActivity(activity)}
                  />
                  <span>{activity}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="metadata-field metadata-field--wide">
            <label htmlFor="map-source">Source or credit</label>
            <input
              id="map-source"
              value={metadata.source}
              onChange={(event) => updateField("source", event.target.value)}
              placeholder="Organization, website, archive, photographer, or notes"
              autoComplete="off"
            />
          </div>

          <fieldset className="metadata-field metadata-field--wide visibility-options">
            <legend>Visibility</legend>
            <label>
              <input
                type="radio"
                name="map-visibility"
                value="private"
                checked={metadata.visibility === "private"}
                onChange={() => updateField("visibility", "private")}
              />
              <span><strong>Private</strong><small>Keep it private until you choose Share</small></span>
            </label>
            <label>
              <input
                type="radio"
                name="map-visibility"
                value="public-ready"
                checked={metadata.visibility === "public-ready"}
                onChange={() => updateField("visibility", "public-ready")}
              />
              <span><strong>Ready to share later</strong><small>Local label only; saving does not publish</small></span>
            </label>
          </fieldset>
        </div>

        {validationError || saveError ? (
          <p className="form-error" role="alert">{validationError ?? saveError}</p>
        ) : null}

        <footer className="map-metadata-form__footer">
          <p>Saves locally first. Public or Unlisted sharing is a separate action in My Maps.</p>
          <div>
            <button className="button button--quiet" type="button" onClick={onDismiss} disabled={saving}>
              Cancel
            </button>
            <button className="button button--signal" type="submit" disabled={saving}>
              {saving ? "Saving map…" : "Save to My Maps"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
