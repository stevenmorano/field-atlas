# Implementation plan

Status: active local prototype  
Last updated: 2026-08-10

## Delivery strategy

Build the risky core locally before adding accounts or infrastructure. The current application already proves that arbitrary raster images can be anchored, saved, reopened, viewed with foreground GPS, and warped over a modern basemap in a browser.

The next steps prioritize protecting real user work, then making map preparation complete, then adding the community backend that gives the product its catalog value.

## Completed foundation

- [x] Next.js App Router, TypeScript, React, responsive shell, and installable PWA metadata.
- [x] Warm editorial Field Atlas visual system with accessible type and controls.
- [x] Sample Discover catalog with search, subject filters, one-shot foreground geolocation, and distance ordering.
- [x] Uploaded raster selection and full-resolution browser Blob handling.
- [x] Fixed-size responsive Anchor Lab with independent image and MapLibre gestures.
- [x] Street, Satellite, and Hybrid built-in basemap modes.
- [x] Numbered predict/correct anchor workflow, delete, clear, undo, and redo.
- [x] Similarity, affine, and Delaunay piecewise-affine georeferencing with inverse projection and mesh warnings.
- [x] Deep uploaded-map zoom up to 3200% with pointer-focused wheel behavior.
- [x] View-only 0/90/180/270-degree uploaded-map rotation.
- [x] Debounced and explicit local draft persistence in IndexedDB.
- [x] Structured named maps and searchable My Maps library.
- [x] Safe fresh-map confirmation and saved-map editing without accidental duplicates.
- [x] Foreground GPS viewer with image-space accuracy visualization.
- [x] Warped Compare overlay with opacity, visibility, basemap choices, and fit.
- [x] Unit tests and lint/type/test/build validation workflow.

## Immediate increment: portable backup and restore

Goal: protect every locally created map before more browser-only work accumulates.

Confirmed scope:

- One action backs up all visible saved maps and the active unfinished Anchor Lab draft, if present.
- Original image Blobs, intrinsic dimensions, every anchor, editor state, metadata, IDs, and timestamps are preserved.
- Import must preview and validate the package before any IndexedDB writes.
- Import is non-destructive: existing maps are never silently overwritten or deleted.
- A malformed, truncated, unsupported, or incomplete package leaves current storage unchanged.
- The operation remains local and does not require an account or network.

Still to lock in the feature design:

- Package representation and extension.
- Exact duplicate and same-ID conflict behavior.
- Whether the imported active draft replaces the current draft, is skipped, or requires an explicit choice.
- Size limits and progress/error behavior for high-resolution image collections.

No backup implementation should begin until those decisions are documented and accepted.

## Next local-product increments

1. **Image preparation:** browser-independent PDF page conversion, HEIC fallback decoding, nondestructive crop, and preparation rotation.
2. **Viewer/offline hardening:** verified production-route caching, storage-health messages, and install/update behavior on real iPhone and Android browsers.
3. **Map details:** dedicated read-only details view, metadata editing improvements, coverage summary, and clearer map quality reporting.
4. **Discover integration:** replace sample cards with local/private catalog entries while preserving current-location prioritization.
5. **Usability pass:** mobile Anchor Lab layout, touch precision/magnifier, anchor move workflow, residual feedback, and accessibility QA.

## Public beta phases

1. Accounts, private-by-default ownership, and server-side map/revision metadata.
2. Original and derivative object storage with resumable uploads and safe image/PDF processing.
3. Anonymous public discovery and viewing with structured place/date/type filters.
4. Downloadable offline map packages with explicit revision updates.
5. Publishing, reports, volunteer anchoring proposals, administrator review, and notifications.
6. Duplicate/variant collections, objective quality ranking, votes as a supporting signal, and admin recommendations.
7. Native iPhone and Android evaluation after the PWA beta proves usage.

## Explicit non-goals for the current local phase

- Turn-by-turn navigation, routes, track recording, or background GPS.
- Friend locations or live sharing.
- Automatic computer-vision anchoring.
- Survey-grade guarantees.
- Public claims implied by the local `public-ready` metadata value.
- Destructive cleanup of user maps for storage convenience.

## Quality gate for every increment

1. Update the relevant decision record and current-state documentation.
2. Add deterministic unit tests for pure data/geometry behavior.
3. Exercise the user flow in the browser at desktop and mobile dimensions when UI changes.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
5. Check dependency audit results when dependencies change.
6. Confirm the change did not mutate existing IndexedDB records unless that migration is explicitly part of the accepted design.
