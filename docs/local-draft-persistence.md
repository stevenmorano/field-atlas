# Local anchor draft persistence

Status: implemented and extended  
Last reviewed: 2026-08-10

## Understanding summary

- A draft preserves the uploaded image and its anchors together.
- Saving works locally and offline without an account.
- The editor autosaves after meaningful changes and also offers **Save draft**.
- Reopening or refreshing `/anchor` restores the current draft.
- The local beta keeps one active draft alongside multiple finished My Maps records.
- Browser storage is private to the current origin, profile, and device.

## Assumptions and requirements

- IndexedDB is available and has enough quota for the original image Blob.
- Clearing site data can remove the local-only draft.
- Initial loading must finish before autosave can run.
- A failed write must not clear the in-memory editor.
- Old records without optional newer fields must remain readable.

## Approaches considered

1. **IndexedDB draft (selected):** stores structured data and binary image Blobs, works offline, and survives reloads.
2. **localStorage:** rejected because large image data exceeds its practical synchronous limits.
3. **Server draft:** deferred because accounts, uploads, privacy, and synchronization are outside the local phase.

## Current design

The Anchor Lab owns one versioned `current` record in the `anchor-drafts` IndexedDB store. After hydration, choosing an image, editing anchors, changing zoom, rotating the working view, or changing the basemap schedules a 700 ms debounced save. The manual control writes immediately and reports saving, saved, and error states.

The record contains the original filename and Blob, intrinsic dimensions, every anchor pair, target zoom, optional 0/90/180/270-degree working-view rotation, basemap mode, save timestamp, and optional linked saved-map ID. Missing rotation defaults to zero degrees.

When linked to a finished map, later autosaves also update that saved map's image and anchor content while preserving metadata and creation time. `/anchor/new` checks for a draft and requires an explicit fresh-map action before deleting only the `current` record. Finished records in My Maps remain untouched.

## Reliability and errors

- Hydration completes before autosave, preventing a blank editor from overwriting existing work.
- Object URLs are recreated from stored Blobs and revoked when replaced or unmounted.
- Failed writes leave the editor state intact and show a visible retry state.
- The version field and optional fields support later migrations.
- Portable backup includes the active draft, but IndexedDB durability and an unverified or lost download are not substitutes for a retained backup copy.

## Decision log

- Selected IndexedDB for offline structured records and image Blobs.
- Selected one replaceable active draft to keep the beta workflow explicit.
- Selected debounced autosave plus a manual checkpoint.
- Added named finished maps without changing the single-active-draft model.
- Persisted editor rotation as optional view state, not as transformed source pixels.
- Added local portable export while keeping accounts, server sync, and sharing in separate increments.
