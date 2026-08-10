# Changelog

This project is pre-release. Entries describe the working local prototype rather than published package versions.

## Unreleased - 2026-08-10

### Added

- Browser-local My Maps library with structured metadata and original image Blobs.
- Safe new-map flow that distinguishes the active draft from finished maps.
- Saved-map GPS viewer with high-resolution pan/zoom, projected accuracy area, recentering, and extrapolation warnings.
- Saved-map Compare mode with warped triangle rendering, opacity, overlay visibility, base-layer selection, and fit-to-overlay.
- Uploaded-map working-view rotation in 90-degree steps with original-coordinate preservation.
- Street, Satellite, and Hybrid base-map modes for the built-in MapLibre style.
- Exact-source saved-map consolidation that retains superseded records.
- Current architecture, user, privacy/data, and documentation index guides.

### Changed

- Uploaded-map zoom now stays inside a fixed editor pane and supports up to 3200% magnification.
- Wheel zoom preserves the pointer focus instead of resizing the page.
- Anchor predictions and map markers are guarded against MapLibre initialization timing errors.
- Starting a map no longer silently reuses or removes an active draft.

### Known limitations

- User maps exist only in the current browser origin; portable backup/restore is planned next.
- Discover uses sample data and its Details buttons are non-functional placeholders.
- There are no accounts, server publishing, public catalog, reports, favorites, or community anchoring yet.
- PDF conversion, cropping, free-angle source preparation, and browser-independent HEIC decoding are not implemented.
- The development server does not register the production service worker.
