# Changelog

## 2026-08-15 - Anchor Lab mesh diagnostics

- Folded-mesh warnings now identify the exact anchor numbers involved.
- The affected triangle is outlined on the uploaded map and basemap, while its anchor markers and correction-history rows are highlighted for targeted correction.
- The warning distinguishes the number of folded triangles from the number of unique anchor points involved, since several triangles may share anchors.

## 2026-08-15 - Public viewer fallback

- Fixed anonymous public maps that could fail to open when the private cloud endpoint was unavailable or not configured.
- Public viewing now continues to the authorized publication copy after an unavailable private-cloud response; private cloud access remains available when it exists.
- Added regression coverage for unauthorized, forbidden, missing, server-error, and unconfigured private-cloud responses.

## 2026-08-14 - Cloud checkpoint acknowledgement

- Fixed the My Maps cloud-save status when a local save changes only its timestamp but not its content: an idempotent **already backed up** response now acknowledges that local version instead of leaving the card stuck on **Changes ready to back up**.
- The acknowledgement is stored with the local cloud-sync state, so the card remains consistent after refresh and becomes dirty again only after a real local change or a newer cloud revision.
- Share now offers **Save progress to cloud** directly inside the stale-cloud warning, then rechecks the checkpoint before enabling publication.
- Added regression coverage and clarified the behavior in the user, architecture, API, privacy, and beta-readiness documentation.

## 2026-08-14 - Publication status and catalog freshness

- My Maps now reflects the account publication state (`Public`, `Pending review`, or `Private`) instead of relying only on the local “ready to share” flag.
- Sharing and making a map private refresh the owner library immediately, so the card and Share dialog agree without a manual reload.
- Discover now has a deliberate **Refresh maps** action and its catalog response is explicitly non-cacheable, so a newly public map can appear as soon as the publication exists.
- Finish-map visibility choices now explain that **Ready to share later** is only a local preparation label; actual Public or Unlisted sharing happens through **Share** in My Maps.

## 2026-08-14 - Clear public revision updates

- Share now identifies when the current public map is older than the latest synced cloud revision.
- Added explicit **Update public map** and **Update shared map** actions with a plain-language immutable-history explanation.
- Added regression coverage for older-public-revision detection and updated the user, API, architecture, and beta-readiness documentation.

## 2026-08-14 - Public information pages

- Added account-free **About Field Atlas**, **How to use**, and user-facing **Changelog** pages.
- Added responsive privacy-safe walkthrough visuals explaining public viewing, GPS, Compare, creator accounts, Anchor Lab, saving, and sharing.
- Added Learn links to desktop/mobile navigation and a shared information footer without changing the creator workflow.

## 2026-08-14 - Creator account and unified My Maps workflow

- Added an account gate before image upload, Anchor Lab, editing, map creation, cloud backup, and publishing while keeping anonymous public viewing, GPS, and Compare open.
- Replaced the split local/cloud My Maps presentation with Drafts first and one completed library containing local and cloud-only records.
- Added explicit **Save progress to cloud**, automatic private backup on **Finish map**, client/API cooldowns, duplicate-fingerprint no-ops, **Download latest**, and safe **Remove from this device** controls.
- Added cloud checkpoint timestamp clarity, update-in-place download behavior, regression tests, and synchronized product, privacy, setup, architecture, and beta-readiness documentation.
- Fixed My Maps card previews and action wrapping, and made cloud-only maps openable/comparable online before optional offline saving.
- Fixed cross-device revision detection when cloud anchor content is newer but its client timestamp is older than the local browser copy.
- Allowed the Anchor Lab uploaded-map pane to zoom out to 50% for large sheets.
- Centered reduced-zoom sheets below the editor controls and hardened uploaded-map pointer dragging against native image ghost-drag behavior, including lost-pointer cleanup.
- Added reciprocal Anchor Lab hover previews so moving over either pane shows the corresponding point in the other pane.

## 2026-08-12 - Beta-readiness backlog

- Added [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md) as the maintained release checklist for interaction bugs, public Compare, revision updates, rotation, saving language, favorites, and production verification.
- Reordered the implementation plan around the beta-readiness interaction and public-workflow gates before broader invitations.

## 2026-08-12 - Moderation release hardening

- Exercised the complete live anonymous-report and administrator check/changes-requested/hide/restore lifecycle without replacing the existing publication or private map data.
- Replaced blocking moderation prompts with accessible reason dialogs and validated corrective-action reasons server-side.
- Prevented cached detail and asset-authorization redirects from outliving a moderation hide.
- Blocked owner unpublishing while a map-level hold is active in the application and added an additive database enforcement migration.
- Added precise owner-facing access labels, held-map controls, optional source/reference notes for physical and public-domain maps, report follow-up expectations, and regression tests.

## 2026-08-12 - Publication hardening

- Prevented an unchanged synced revision with identical sharing settings from creating duplicate publication rows and duplicate R2 image derivatives.
- Added a clear **Already published** state while keeping changed revisions, visibility, rights, source, license, and attribution publishable.
- Preserved idempotent retry recovery for interrupted Public and Unlisted publication requests.
- Reconciled project, architecture, privacy, setup, API, operations, and user documentation with the activated beta.

## 2026-08-11 - Community publishing foundation

- Added explicit instant Public and Unlisted publishing for privately synced map revisions.
- Added sanitized high-quality and thumbnail WebP derivatives while keeping original uploads private in R2.
- Added anonymous Discover/detail/image delivery, GPS-capable public viewing, offline saving, and anonymous reports.
- Added generated public usernames, profile editing, public contribution pages, and small admin-checked milestones.
- Added an in-app post-publication moderation queue with checked, changes-requested, hidden, and restored states.
- Added retry-stable unlisted links so an interrupted publish can safely return the same capability URL.
- Replaced the still-active publication form after success with a clear completion screen and direct Open, Copy, Discover, Done, and settings actions.
- Added a deny-by-default additive Supabase migration that removes prototype raw anonymous revision/asset reads without deleting existing private maps.

## 2026-08-11 - Community publishing design

- Approved the instant Public/Unlisted publishing foundation with anonymous viewing and reporting, post-publication moderation, frozen public revisions, safe public derivatives, minimal profiles, and publication milestones.
- Recorded structured Skeptic, Constraint Guardian, User Advocate, and Arbiter review decisions in the community publishing decision record.

## 2026-08-10 - Optional account and private cloud foundation

- Added Supabase SSR email/password account handling using the Next.js 16 Proxy convention.
- Added RLS-protected map, immutable revision, and image asset schema with narrowly granted sync functions.
- Added direct five-minute R2 upload/download signing, server-side object verification, and browser checksum verification.
- Added explicit per-map and all-map private sync controls without deleting or rewriting IndexedDB maps.
- Added stale-device conflict preservation and cloud-only map download into a second browser's local library.
- Added cloud configuration, security-boundary, CORS, privacy, and public-publishing documentation.

This project is pre-release. Entries describe the working local prototype rather than published package versions.

Future discovery work is tracked separately from implemented releases; the planned world-map catalog and compact list view are recorded in [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md).

## Unreleased - 2026-08-10

### Added

- Browser-local My Maps library with structured metadata and original image Blobs.
- Safe new-map flow that distinguishes the active draft from finished maps.
- Saved-map GPS viewer with high-resolution pan/zoom, projected accuracy area, recentering, and extrapolation warnings.
- Saved-map Compare mode with warped triangle rendering, opacity, overlay visibility, base-layer selection, and fit-to-overlay.
- Uploaded-map working-view rotation in 90-degree steps with original-coordinate preservation.
- Street, Satellite, and Hybrid base-map modes for the built-in MapLibre style.
- Exact-source saved-map consolidation that retains superseded records.
- Versioned `.fieldatlas` backup and restore for all active saved maps and the current draft, with exact image bytes, checksum validation, import preview, duplicate skipping, conflict copies, and atomic IndexedDB writes.
- Current architecture, user, privacy/data, and documentation index guides.

### Changed

- Uploaded-map zoom now stays inside a fixed editor pane and supports up to 3200% magnification.
- Wheel zoom preserves the pointer focus instead of resizing the page.
- Anchor predictions and map markers are guarded against MapLibre initialization timing errors.
- Starting a map no longer silently reuses or removes an active draft.

### Limitations at that increment

These were accurate before the later cloud/community entries above and are retained as historical context.

- User maps remained browser-local between manual `.fieldatlas` exports/imports; optional explicit cloud sync was added later.
- Discover used sample data and its Details buttons were placeholders; configured community results were added later.
- Accounts, server publishing, public catalog, and reports had not yet been added. Favorites and community anchoring remain future work.
- PDF conversion, cropping, free-angle source preparation, and browser-independent HEIC decoding are not implemented.
- The development server does not register the production service worker.
