# Local data and privacy

Status: current implementation  
Last reviewed: 2026-08-10

## Storage model

Field Atlas currently uses the browser's IndexedDB database `field-atlas-local` at schema version 2.

| Store | Key | Cardinality | Purpose |
| --- | --- | --- | --- |
| `anchor-drafts` | `current` | One active record | Resume unfinished or actively edited anchor work |
| `saved-maps` | UUID | Multiple records | Named maps shown in My Maps |

No user-created map record is stored in `localStorage`. Image files remain binary `Blob` values so high-resolution originals do not incur base64 expansion.

## Active draft record

`LocalAnchorDraft` version 1 contains:

- save timestamp;
- original filename and image Blob;
- intrinsic width and height;
- all anchor pairs;
- uploaded-map zoom;
- optional 0/90/180/270 working-view rotation;
- current basemap mode;
- optional linked saved-map ID.

The optional rotation field is backward-compatible: older records without it open at zero degrees.

## Saved map record

`LocalSavedMap` version 1 contains:

- UUID, created timestamp, and updated timestamp;
- structured `SavedMapMetadata`;
- original filename, Blob, and intrinsic dimensions;
- all anchor pairs;
- target zoom and basemap mode;
- optional `supersededBy` pointer used for non-destructive consolidation;
- optional intentional-variant marker; and
- optional import lineage for a divergent same-ID map preserved as an imported copy.

Metadata contains title, description, place name, subject, visual style, map date kind/year, activity tags, source, and private/public-ready intent. Public-ready currently has no network effect.

## Write behavior

- Draft changes are debounced by 700 ms and can also be saved immediately.
- Initial draft hydration completes before autosave begins, preventing the blank editor from overwriting an existing record.
- Finishing a map writes the saved record and then links the active draft to its stable UUID.
- Later edits to a linked draft update saved image/anchor content while retaining metadata and creation time.
- Starting a fresh map deletes only the `current` draft after explicit confirmation. It does not delete finished My Maps records.
- Backup export is read-only and does not update map or draft timestamps.
- Confirmed import validates the whole package first, then writes saved maps and the optional draft in one transaction spanning both stores.
- The application currently exposes no saved-map deletion control.

## Duplicate consolidation

An exact-source signature uses normalized filename, image width/height, Blob byte size, and MIME type. Records with that signature are grouped when My Maps is listed. The active record with the most anchors (then newest update) becomes canonical; unique anchor IDs from sibling records are merged. Other records receive `supersededBy` and remain stored.

This behavior is a recovery aid, not perceptual duplicate detection. Different scans, filenames, crops, byte sizes, editions, or resolutions remain separate maps.

## GPS privacy boundary

Foreground location readings are held in React/browser memory only. They are used to:

- sort the sample Discover catalog after a one-shot request; or
- project a live viewer reading onto a saved image.

The current application does not write live coordinates, accuracy readings, viewing history, or traveled paths to IndexedDB, URLs, analytics, logs, or an application server. The saved anchor coordinates are map calibration data, not a user's live location.

The viewer starts `watchPosition` only after **Find me** and clears it when hidden or unmounted.

## Network boundary

User image Blobs, metadata, and anchors are not uploaded by the current build. Network requests may still go to:

- the Next.js development/production web origin;
- OpenStreetMap raster tiles;
- Esri World Imagery; or
- a configured MapLibre style and its referenced providers.

The production service worker caches same-origin application resources, not a complete cross-origin basemap.

## Data-loss risks

IndexedDB is durable browser storage, not a backup. Data may be lost if the user clears site data, removes the browser profile, uses private-browsing storage, changes origin, or the browser evicts storage. There is currently no cross-device synchronization.

Field Atlas now provides a portable, versioned `.fieldatlas` backup containing active saved maps, exact original image bytes, anchors and metadata, plus the active unfinished draft. Import validates the package before writing, skips exact duplicates, preserves divergent same-ID records as separate imported copies, and keeps the current draft by default.

The downloaded file is still user-managed. Field Atlas cannot verify that it remains available after download and does not upload it to a cloud account. Losing both the browser data and every exported copy still loses the library.

## Portable backup privacy boundary

Backup creation and import run locally. The package is a binary container with a versioned JSON manifest and SHA-256-addressed raw image payloads; images are not resized, recompressed, or base64-expanded. The package excludes live GPS readings, location history, browsing history, and secrets. Because it may contain private maps and filenames, treat the file as sensitive data.

## Future server boundary

The validated public-beta design adds accounts, cloud files, public metadata, revisions, reports, and contributions. Its invariant remains that live GPS does not leave the device. See [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md).
