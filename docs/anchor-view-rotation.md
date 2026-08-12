# Anchor workspace rotation

Status: implemented  
Last reviewed: 2026-08-12

## Understanding summary

- The uploaded-map pane has 90-degree controls so sideways maps can be compared with a north-up basemap.
- Rotation is an anchoring aid and never alters the original Blob, image quality, anchors, GPS projection, or Compare rendering.
- Existing markers remain attached to their original landmarks after rotation.
- Pointer input is converted back to original image pixels before storage.
- Orientation survives active-draft autosave and refresh.
- The obsolete one-off Marshlands recovery control was removed.

## Assumptions and requirements

- Exactly four view orientations exist: 0, 90, 180, and 270 degrees.
- Finished maps retain original source orientation; only the active draft stores the working view.
- Older drafts without a rotation open at zero degrees.
- Pure coordinate helpers and unit tests are preferred over a graphics dependency.
- Rotation must remain compatible with fixed-pane pan/zoom up to 3200%.

## Approaches considered

1. **View-only rotation with coordinate conversion (selected):** rotate display and markers, and invert clicks before saving.
2. **Physically rotate the Blob:** rejected because it duplicates large images and requires rewriting anchors.
3. **CSS rotation without coordinate conversion:** rejected because clicks and markers would refer to the wrong pixels.

## Current design

Rotate-left and rotate-right controls sit beside uploaded-map zoom. `TargetViewRotation` is `0 | 90 | 180 | 270`. Pure helpers calculate rotated dimensions, transform original points for rendering, and invert displayed pointer positions.

The draft stores optional `targetRotation`; missing values normalize to zero. Selecting a new source resets the view to zero. Saved-map content intentionally omits rotation because georeferencing stays in original coordinates.

## Decision log

- Use 90-degree steps rather than a free-angle control.
- Preserve source pixels and anchors; rotate only the editor view.
- Persist rotation only in the active draft.
- Use an optional backward-compatible field instead of a database migration.
- Remove the hard-coded recovery tool after its original use was complete.
