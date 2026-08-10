# Local map Compare mode

Status: implemented  
Last reviewed: 2026-08-10

## Understanding summary

- A saved anchored image can be viewed as a transparent overlay on current geography.
- Existing anchors drive the overlay; calibration is not repeated.
- The overlay can rotate, resize, skew, and locally stretch so anchor landmarks line up.
- The main purpose is casual historic/current comparison, not a full GIS or OldMapsOnline replacement.
- One browser-local saved map is compared at a time.

## Requirements

- The original Blob and anchors remain in IndexedDB and are never uploaded by Compare.
- Canvas 2D and MapLibre are required.
- Rendering favors responsive interaction over export-grade resampling.
- Street, Satellite, and Hybrid modes use the existing basemap configuration.
- Fewer than two usable anchors cannot produce an overlay.
- The source image's rectangle is the initial clipping boundary.

## Approaches considered

1. **Existing model plus browser-rendered mesh (selected):** project image corners, a support grid, and anchor vertices, then draw source triangles into screen triangles.
2. **Allmaps renderer:** powerful but normally centered on IIIF and Georeference Annotations, adding a larger data-contract change.
3. **Server-generated warped tiles:** strong GIS performance but requires uploads, workers, storage, and tile pyramids.

## Current design

My Maps and the saved-map viewer link to `/maps/[mapId]/compare`. The page loads the Blob, dimensions, metadata, and anchors, creates a Delaunay mesh, projects its vertices through the progressive model, and fits MapLibre to the overlay.

A transparent Canvas 2D layer redraws source triangles into their projected MapLibre screen triangles. Anchor vertices are included exactly; grid and edge points provide coverage. Areas outside the anchor hull use the global fallback and are extrapolated.

Controls include a 0-100% opacity slider (55% default), show/hide overlay, Street/Satellite/Hybrid selection, and **Fit overlay**. Compare never edits the saved record.

## Current limitations

- Canvas interpolation is not GIS/export grade.
- There is no custom border cutline, GeoTIFF export, or public tile service.
- Extrapolated regions can drift.
- Users do not choose similarity, affine, polynomial, or TPS modes.
- Basemap imagery still depends on its network provider unless already cached.

## Decision log

- Reuse the current anchors and progressive model as the single calibration source.
- Start with one triangulated local overlay rather than cloning every GIS transform type.
- Use synchronized Canvas 2D now while keeping mesh generation renderer-independent.
- Default to 55% opacity and retain a simple show/hide action.
- Keep the rectangular source border and defer cutlines.
- Keep the feature browser-local and server-free.
