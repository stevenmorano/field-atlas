# Implementation plan

Status: local, private-cloud, and core community beta active in development; moderation release gate passed and beta-readiness interaction/workflow gate next
Last updated: 2026-08-12

## Delivery strategy

The project deliberately proved the risky georeferencing core locally before adding accounts or infrastructure. The current application now carries that browser-local workflow through optional private cloud sync and instant community publishing without making either service a prerequisite for map creation or use.

The next steps prioritize plain-language public workflows, reliable map interaction, and release verification around the working community path, followed by map-preparation and editing improvements. See [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md) for the maintained tester-facing gate.

## Completed foundation

- [x] Next.js App Router, TypeScript, React, responsive shell, and installable PWA metadata.
- [x] Warm editorial Field Atlas visual system with accessible type and controls.
- [x] Live public Discover catalog with an unconfigured sample fallback, search, subject filters, one-shot foreground geolocation, and distance ordering.
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
- [x] Portable `.fieldatlas` backup/restore with exact images, import preview, conflict preservation, and draft protection.
- [x] Optional Supabase email/password accounts with private-by-default Postgres/RLS records.
- [x] Direct, signed Cloudflare R2 original-image upload/download with verification.
- [x] Explicit local-to-cloud sync, immutable revisions, stale-device conflict preservation, and cloud-to-device download.
- [x] Explicit Public/Unlisted publication with sanitized WebP derivatives and private originals.
- [x] Anonymous Discover, map viewing, foreground GPS, offline save, profiles, and problem reports.
- [x] Post-publication administrator queue with check, changes-requested, hide, and restore actions.
- [x] Exact duplicate-publication protection before R2 processing.
- [x] Unit tests and lint/type/test/build validation workflow.

## Completed increment: portable backup and restore

Goal: protect every locally created map before more browser-only work accumulates.

Delivered scope:

- One action backs up all visible saved maps and the active unfinished Anchor Lab draft, if present.
- Original image Blobs, intrinsic dimensions, every anchor, editor state, metadata, IDs, and timestamps are preserved.
- Import must preview and validate the package before any IndexedDB writes.
- Import is non-destructive: existing maps are never silently overwritten or deleted.
- A malformed, truncated, unsupported, or incomplete package leaves current storage unchanged.
- The operation remains local and does not require an account or network.

Implemented design details:

- Use a versioned `.fieldatlas` binary package with a JSON manifest and raw image payloads.
- Deduplicate package images by SHA-256 without resizing or recompression.
- Skip identical records and preserve divergent same-ID maps as visible imported copies.
- Keep an existing active draft unless replacement is explicitly confirmed.
- Validate the complete package before one atomic IndexedDB transaction.
- See [`docs/portable-backup.md`](docs/portable-backup.md) for the package contract and test plan.

## Next increments

1. **Beta-readiness interaction gate:** fix viewer control occlusion, GPS panel density, Anchor Lab safe pan bounds, and maximum-zoom dragging; verify desktop and mobile touch behavior.
2. **Public workflow gate:** expose Compare to anonymous public visitors, clarify Sync changes → Update public map, and ship optional source/reference metadata.
3. **Orientation design:** implement and verify non-destructive default/viewer rotation, starting with 90-degree controls and Reset.
4. **Production release gate:** run a clean production build, configure Vercel environment values, deploy, then verify authentication redirects, R2 CORS, anonymous access, GPS, and private sync on the deployed origin.
5. **Mobile/offline release gate:** test installation, updates, storage-health messaging, offline public saves, and foreground GPS on real iPhone and Android browsers.
6. **Persistent community favorites:** add account-backed favorites with clear separation from browser-local saves and private cloud downloads.
7. **Operational hardening:** add publish throttles/global pause, orphan-object cleanup, report disposition history, and recovery checks before expanding beyond the small beta.
8. **Image preparation:** add browser-independent PDF page conversion, HEIC fallback decoding, nondestructive crop, and preparation rotation.

## Completed increment: moderation release gate

- Exercised anonymous reporting, administrator check, changes requested, hide/hold, restore, and final checked state against the configured services.
- Confirmed changes-requested publications remain accessible, while hidden publications disappear from Discover, profiles, detail, and asset delivery.
- Confirmed restoration resumes access without replacing the immutable publication, private revision, original image, or browser-local map.
- Replaced blocking moderation prompts with accessible in-app reason dialogs and required reasons for corrective actions.
- Made publication detail and authorized asset redirects non-cacheable so every request rechecks effective access.
- Blocked owner unpublishing in the application while a moderation hold is active and added the matching additive database migration.
- Clarified rights declarations without blocking physical maps or personal photographs on a missing web source, alongside anonymous-report confirmation and owner-facing moderation labels.

## Public beta phases

1. [x] Accounts, private-by-default ownership, server-side map/revision metadata, and original object storage foundation.
2. [x] Sanitized raster derivatives for supported image inputs; background processing and PDF conversion remain later hardening.
3. [x] Anonymous public discovery/viewing; richer place/date/type filtering remains.
4. [x] Anonymous offline saving; explicit public revision-update comparison remains.
5. [x] Instant Public/Unlisted publishing, anonymous reports, and post-publication check/hide/restore; richer notifications remain.
6. Volunteer anchoring proposals, accepted-improvement credit, and contribution notifications.
7. Duplicate/variant collections, objective quality ranking, votes as a supporting signal, and admin recommendations.
8. Native iPhone and Android evaluation after the PWA beta proves usage.

## Explicit non-goals for the current beta

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
