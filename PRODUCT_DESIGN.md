# Community Georeferenced Maps — Product and Technical Design

Status: Validated public-beta design with a working local/cloud/community beta
Original design date: 2026-08-09
Last reviewed: 2026-08-12
Working product name: Field Atlas (final branding remains open)

## Document scope and implementation snapshot

This document describes the intended public beta. The configured development environment now runs optional accounts, private cloud sync, original R2 transfer, immutable revisions, Public/Unlisted publishing, anonymous discovery/viewing/reporting, minimal profiles, and administrator check/hide/restore. Fresh environments still require [`docs/CLOUD_SETUP.md`](docs/CLOUD_SETUP.md). Volunteer improvements and the larger-launch safeguards in [`docs/community-publishing-foundation.md`](docs/community-publishing-foundation.md) remain future work.

The repository currently implements:

- a Next.js 16 App Router PWA shell and live Discover catalog with an unconfigured sample fallback;
- local raster upload and a split Anchor Lab with Street, Satellite, and Hybrid MapLibre basemaps;
- similarity, affine, and triangulated piecewise-affine forward/inverse georeferencing;
- 90-degree working-view rotation, deep pan/zoom, undo/redo, mesh warnings, and draft autosave;
- a multi-map IndexedDB My Maps library with structured metadata;
- a versioned, non-destructive portable backup/restore flow for local maps and the active draft;
- a high-resolution foreground-GPS viewer that keeps readings on-device; and
- a locally warped Compare overlay with opacity and fit controls;
- email/password accounts and explicit private cross-device sync using Supabase and R2;
- instant Public/Unlisted publication using sanitized public image derivatives;
- anonymous public map viewing, foreground GPS, offline save, and reporting; and
- public profiles, contribution milestones, moderation, and exact-publication deduplication.

PDF conversion, cropping, volunteer anchoring, favorites, richer duplicate grouping/ranking, larger-scale operational safeguards, production release verification, and native applications remain planned. Cloud behavior activates only when the managed services are configured. Current behavior is documented in [`README.md`](README.md) and [`docs/README.md`](docs/README.md).

## 1. Product vision

Build a modern, web-first map application that lets anyone upload an image or PDF of nearly any map, connect landmarks on that image to real geographic locations, and then see their live GPS position on the uploaded map.

The defining examples are:

- A photographed trail sign used as an offline GPS map.
- An illustrated zoo or amusement-park map showing the user's real position.
- An 1852 town map used to see where the user stands in the historic landscape.
- A rotated, skewed, photographed, or locally distorted map corrected with many anchor pairs.

The initial product is an installable mobile-friendly web app/PWA. Native iPhone and Android apps may follow after the web beta proves the experience.

## 2. Why it exists

Traditional mapping products prioritize navigation and conventional geographic layers. This product instead makes arbitrary raster maps geographically usable. Its value comes from two things:

1. A strong anchor-and-correction workflow that can georeference unusual maps.
2. A community catalog where one contributor's work becomes useful to everyone.

The original inspiration proved the concept but had a dated interface, legacy image limits, and an aging platform. This project should preserve the simple utility while modernizing creation, discovery, offline use, image quality, and community maintenance.

## 3. Target users

- Former Maprika users looking for a maintained replacement.
- Hikers, skiers, cyclists, boaters, and park visitors.
- Local historians, genealogists, and historic-map enthusiasts.
- Visitors to zoos, amusement parks, campuses, fairs, and large venues.
- Map collectors who can contribute source images but may not have time or skill to anchor them.
- Power users willing to anchor or repair community maps.

## 4. Beta success criteria

The beta is successful when approximately 20–50 testers can:

- Upload supported files without losing the original.
- Crop, rotate, describe, and anchor a map.
- Use up to roughly 50 anchors where necessary.
- Publish or request community anchoring.
- Find public maps covering their current location.
- Open maps online or download them for offline use.
- Reliably see foreground GPS position on downloaded and online maps.
- Report inaccurate public maps.

The first beta may contain only a few dozen public maps. Catalog size is not the initial success metric.

## 5. Explicit non-goals for beta

- Turn-by-turn navigation or route planning.
- Recording tracks or drawing lines showing where the user traveled.
- Background GPS tracking.
- Friend locations, messaging, or live location sharing.
- Survey-grade accuracy guarantees.
- Automatic computer-vision georeferencing.
- Full collaborative editing of an owner's working draft.
- Native iOS or Android releases.

The optional on-location “I'm here” correction may be added later but is not required for beta.

## 6. Product principles

- Keep the interface simple even when the internal math is sophisticated.
- Make live GPS on arbitrary maps the primary experience.
- Preserve manual control; predictions help but never prevent correction.
- Keep private maps private by default while encouraging useful public contributions.
- Never transmit or store live GPS coordinates.
- Preserve high-resolution source detail.
- Make downloaded maps dependable without cellular service.
- Prefer managed, low-maintenance, inexpensive infrastructure.

## 7. Access and privacy model

### Guests

Guests can browse, search, preview, open, download, and report public maps without an account. They can also open an Unlisted map when given its secret link.

### Accounts

An account is required to:

- Upload maps.
- Save private maps.
- Publish maps.
- Favorite maps.
- Synchronize personal catalog data.
- Submit anchor contributions.
- Receive public attribution, maintain a profile, and earn reviewed contribution milestones.

### GPS privacy

Live coordinates are processed only in the browser. The backend stores map images, metadata, anchor pairs, revisions, favorites, reports, and moderation state, but never a user's current location, viewing history, or traveled path.

## 8. Primary product surfaces

The product has five primary surfaces:

1. Discover — public catalog on a map or in a filtered list.
2. My Maps — downloaded, private, published, recent, and favorite maps.
3. Upload — file selection, preparation, metadata, and anchoring entry point.
4. Anchor Editor — paired uploaded-map and basemap control points.
5. Map Viewer — high-resolution map, GPS marker, orientation, comparison, and offline state.

Mobile navigation should remain limited to Discover, My Maps, Account, and a prominent upload action.

## 9. GPS-aware discovery

Once the user grants foreground location permission, Discover groups maps as follows:

- You're on these maps — the current point falls inside the map's reliable coverage.
- Nearby maps — sorted by distance to the closest coverage edge.
- Downloaded maps — locally available with offline/update state.
- Search all maps — map and list views with structured filters.

Coverage is derived from the transformed crop boundary and reliable anchored region, not from a single center pin.

Opening behavior is contextual:

- Downloaded and inside coverage: open the viewer immediately.
- Not downloaded: show details with Open Online and Download for Offline.
- Outside coverage: show distance and offer Open Anyway or Find Maps Here.
- No location permission: remain fully usable without location-specific ordering or warnings.

## 10. Upload and preparation

Supported beta inputs:

- JPEG
- PNG
- WebP
- HEIC
- PDF with page selection

The upload flow is:

1. Choose or capture a source.
2. For PDFs, choose the page.
3. Preview and correct orientation.
4. Crop unwanted borders or photographed surroundings.
5. Enter structured metadata.
6. Save privately, begin anchoring, or request community anchoring.

The exact raw upload is retained privately. Public and viewing derivatives have EXIF and embedded GPS metadata removed.

Cropping and rotation are nondestructive. The full source is retained, while crop bounds and rotations are stored as metadata. Changing a crop later warns about excluded anchors instead of silently deleting them.

## 11. Structured metadata and search

Required and optional metadata are separated into useful facets.

### Core fields

- Title: required free text.
- Description: optional free text.
- Place name: town, park, resort, venue, or region.
- Subject: city/town, trail, park/preserve, zoo/amusement venue, ski/winter, nautical, campus, transit, property/parcel, event/course, or other.
- Visual style: conventional, illustrated/cartoon, hand-drawn, aerial/photo, topographic, or chart.
- Activity tags: hiking, biking, skiing, boating, history, sightseeing, and others.
- Source and attribution: organization, URL, notes, and rights confirmation.

### Dates

- Map date: current, unknown, exact year, approximate year, or range.
- Original edition/publication date: optional.
- Upload date: automatic and immutable.
- Last improved date: latest published revision.

Users can independently search or sort by place, current coverage, radius, subject, style, activity, map year, decade, upload date, improvement date, quality, title, and contributor.

## 12. Anchor editor interaction

The anchor workflow is a repeated predict-correct-learn loop.

1. Display the uploaded map and satellite/hybrid basemap in independently pannable and zoomable panes.
2. The user moves a crosshair to a landmark on the uploaded map.
3. A provisional marker moves live on the basemap using the current transform.
4. The user sets the image point, then pans, zooms, and corrects the basemap marker.
5. A long press may show a magnified precision view.
6. Saving creates a numbered anchor pair.
7. Recalculate immediately so the next prediction improves.

The prediction also works in reverse: movement over the basemap predicts the uploaded-map position.

On phones, the default is uploaded map above the basemap with a draggable divider. Landscape and desktop may use side-by-side panes. A full-pane toggle remains available on small screens.

The editor includes:

- Add, move, and delete anchors.
- Undo and redo.
- Autosave.
- Numbered paired anchors.
- Residual-error and distribution feedback.
- Folded-mesh warnings.
- Confidence indication for provisional predictions.
- Resumable editing at any later time.

## 13. Progressive georeferencing model

The selected approach is a progressive global-to-triangulated transformation.

### Zero anchors

No prediction is possible. Both sides are chosen manually.

### One anchor

Only translation is known. Any estimate is visibly low confidence.

### Two anchors

The model infers position, rotation, and approximate uniform scale. A map can be sideways or upside down without user configuration.

### Three or more anchors

A global affine model can account for nonuniform scale and skew.

### Distributed anchors

A triangulated piecewise-affine rubber-sheet mesh corrects local distortion. Each image triangle maps to a geographic triangle. Within a triangle, forward and inverse transforms are deterministic and inexpensive. This supports illustrated maps where distances and shapes vary across the artwork.

Outside the reliable anchored region, the system uses a global fallback only with a clear low-confidence warning.

### Quality controls

- Detect anchors that are too close or poorly distributed.
- Calculate residual errors and identify likely contradictory pairs.
- Detect flipped, folded, overlapping, or excessively stretched triangles.
- Block GPS-ready publication for hard geometric failures.
- Allow private experimentation despite warnings.

Editor and viewer rotations do not alter anchor coordinates. Pointer input is converted back into original image space before georeferencing.

## 14. Viewer behavior

The map viewer emphasizes the uploaded map and exposes only essential controls:

- Locate me.
- Zoom.
- Original, north-up, or manual orientation.
- Compare with satellite/hybrid imagery.
- Overlay opacity.
- Download, update, or remove offline copy.
- Map details and report.
- Owner-only editing actions.

The GPS marker includes an accuracy ring and the age of the most recent browser reading. Poor device accuracy is not presented as a map-transform failure.

## 15. Editing, revisions, and offline stability

Every add, move, delete, crop, and rotation action participates in undo/redo history. Completed actions autosave.

The original source remains immutable. Published revisions are also immutable. Editing a public map creates a new draft. Publishing that draft changes the current online revision but does not silently replace downloaded copies.

Offline users receive an update indicator and choose when to install the new revision. Favorites remain attached to the stable map identity.

## 16. Community anchoring

An uploader can select:

- Private draft.
- Request community anchoring.
- Publish a GPS-ready revision.

A community request requires basic metadata, a general location, and rights confirmation. It appears in a separate Maps Needing Anchors queue.

Volunteers never directly edit the owner's map. They create independent contribution drafts:

1. Find a map by location, year, or category.
2. Start or temporarily claim the task.
3. Add anchors with autosave and quality feedback.
4. Submit anchors and notes.
5. Administrator reviews the contribution.
6. Acceptance creates a new revision and credits Uploaded by and Anchored by separately.

Claims expire so abandoned work cannot lock a map indefinitely. Administrator review is the default because uploaders may not return.

## 17. Reports and moderation

Effective Public and Unlisted maps accept anonymous community reports without requiring an account. Report reasons include:

- GPS inaccurate.
- Wrong coverage or location.
- Bad or unreadable image.
- Incorrect metadata.
- Copyright or sharing-rights concern.
- Broken download.
- Other, with written notes.

The report automatically includes map and immutable publication identifiers but never the reporter's current GPS coordinate. Reports enter the administrator inbox and may notify the owner. Rate limiting and spam controls do not make ordinary reporters create an account.

Public and Unlisted maps become usable immediately after the owner publishes them; administrator checking happens afterward. The administrator can mark checked, request changes while leaving the map visible, hide and hold the map, restore it, group duplicates, or remove material when required. Hiding preserves the source and history during investigation and blocks owner republication until restored.

## 18. Duplicate maps and variants

Duplicates are allowed. The catalog distinguishes:

- Same place, different map.
- Same artwork/design, different source or scan quality.
- New edition or year.

Potential relationships are suggested using coverage overlap, metadata similarity, exact hashes, and perceptual image similarity. Suggestions never merge or delete automatically.

A collection page shows the recommended map first, then other editions and alternate uploads. Older versions can display a Higher-quality version available notice without disappearing.

Default ranking combines:

- Anchor quality and coverage.
- Image resolution and readability.
- Metadata completeness.
- Report health.
- Official-source status.
- Recency for maps representing current conditions.
- Community accurate/helpful votes.
- Administrator Recommended override.

Votes are a supporting signal, not the sole ranking method.

## 19. System architecture

~~~mermaid
flowchart LR
    PWA[Web/PWA Viewer and Editor] --> Local[IndexedDB Offline Maps]
    PWA --> Geo[Local GPS and Mesh Transform]
    PWA --> API[Managed Application API]
    API --> DB[Supabase Postgres and PostGIS]
    API --> Files[Cloudflare R2 Assets]
    Files --> Worker[Image and PDF Processor]
    PWA --> Base[MapLibre with Online Basemap]
~~~

### Web client

- TypeScript and React PWA.
- MapLibre GL JS for satellite/hybrid interaction.
- Custom WebGL rendering for the triangulated image mesh.
- Web worker for transform calculations when beneficial.
- Browser Geolocation API for foreground position updates.
- Service worker for the app shell.
- IndexedDB for downloaded map packages and structured offline data.

### Managed backend

- Supabase Auth for accounts.
- PostgreSQL/PostGIS for maps, geographic coverage, anchors, revisions, categories, favorites, reports, and ranking data.
- Row-level security for guest, owner, contributor, and administrator access.

### File storage

- Cloudflare R2 for originals, optimized masters, thumbnails, and offline/viewing packages.
- Originals are private and retained indefinitely during beta.
- Signed upload and owner-only original-download access.

### Processing worker

- Validate file type and dimensions.
- Select and render PDF pages.
- Decode HEIC.
- Strip public metadata.
- Generate thumbnail and high-resolution derivatives.
- Build a multi-resolution viewing package.
- Calculate checksums and processing status.

### Basemap

- MapLibre-compatible provider abstraction.
- MapTiler satellite/hybrid is the initial recommendation.
- Provider can be changed later if imagery, licensing, or pricing requires it.

## 20. Image quality and storage

High-resolution detail is a requirement. Maps around 7,000–10,000 pixels per side are normal and must retain readable deep zoom.

The source is never routinely downscaled into a blurry single image. Processing creates an optimized full-frame master, thumbnail, and multi-resolution display package. Compression depends on content:

- Lossless or near-lossless for linework, labels, and historic scans.
- High-quality photographic compression for camera images.

A single-file tile archive such as PMTiles is the leading candidate for the display package because it supports range access on static object storage. A prototype must validate it for both geographic overlay rendering and original-orientation image viewing before it is finalized.

Anchor and metadata storage is negligible compared with raster assets. The design prioritizes speed and quality over aggressively deleting source files.

## 21. Core data model

### Profile

Account identity, display name, role, contribution statistics, and moderation state.

### Map

Stable identity, owner, visibility, metadata, coverage geometry, moderation state, recommended flag, and current published revision.

### Map asset

Original, optimized master, thumbnail, viewing package, checksums, dimensions, and processing state.

### Map revision

Crop, orientation metadata, image-processing version, transform version, quality summary, publication state, and timestamps.

### Anchor

Stable ID, revision, visible order, normalized image coordinates, latitude/longitude, quality data, contributor, and timestamps.

### Contribution

Volunteer working state, claim expiration, anchor draft, notes, quality summary, review status, and reviewer.

### Community records

Favorites, reports, helpful/accurate votes, duplicate relationships, collections, and moderation actions.

## 22. Primary data flows

### Creation

Upload → process → crop/rotate → metadata → anchor → quality check → private draft → publish or request community help.

### Online viewing

Discover → map details/current revision → fetch visible image ranges → browser geolocation → inverse mesh transform → GPS marker.

### Offline viewing

Download current revision → verify checksum → store package, anchors, metadata, and mesh in IndexedDB → open without network → browser geolocation → local inverse transform → GPS marker.

### GPS boundary

Browser location → Web Mercator coordinate → mesh triangle lookup → uploaded-map coordinate → marker. No GPS payload is sent to the server.

## 23. Error and edge-case behavior

- Fewer than two anchors: Not GPS-ready.
- Sparse or clustered anchors: visible low-confidence warning.
- Contradictory anchors: identify likely pairs and offer move/delete/undo.
- Folded or overlapping mesh: block GPS-ready publication.
- Outside reliable coverage: show Outside mapped area rather than confident extrapolation.
- Poor GPS: enlarge accuracy ring and show reading age.
- Permission denied: viewer works without GPS.
- Interrupted upload/download: resume when possible.
- Processing failure: retain original and provide actionable reason.
- Basemap outage: processed/downloaded maps continue working; anchoring pauses safely.
- Browser storage eviction: mark map Needs download rather than showing a blank viewer.
- Corrupt offline package: fail checksum and redownload.
- Duplicate suggestion: require administrator confirmation.
- Expired volunteer claim: return map to the work queue without losing the volunteer's private draft.

## 24. Non-functional requirements

### Performance

- Cached viewer opens in approximately two seconds on an ordinary phone.
- Anchor and map gestures remain smooth with roughly 50 anchors.
- High-resolution maps retain readable deep zoom.
- GPS marker updates immediately after the browser supplies a position.
- Heavy transform or image work does not block pointer interaction.

### Scale

- Initial target: 20–50 beta testers and dozens of public maps.
- Architecture should grow to thousands of maps without redesigning storage or geographic discovery.

### Security and privacy

- HTTPS required.
- Live GPS never leaves the device.
- Private originals require signed, owner/admin-authorized access.
- Row-level database policies enforce map ownership and visibility.
- File validation, size/resource limits, and safe PDF/image decoding are mandatory.
- Public derivatives remove embedded metadata.

### Reliability

- Downloaded maps work when application APIs, basemap services, or cellular connectivity are unavailable.
- Drafts autosave and uploads/downloads resume where practical.
- Database and object storage receive automated backups appropriate to the selected plans.

### Maintenance

- One owner/administrator initially.
- Prefer managed services and automated queues.
- Avoid infrastructure that requires a continuously managed custom tile server.

## 25. Testing strategy

### Mathematical tests

- Synthetic translation, rotation, scale, skew, mirror, and local distortion.
- Forward/inverse round-trip numerical tolerance.
- Randomized 50-anchor meshes.
- Triangle boundaries, folds, overlaps, and extrapolation.
- Regression maps: sideways historic atlas, photographed trail sign, illustrated zoo, nautical chart, and high-resolution town map.

### Workflow tests

- Upload and PDF page selection.
- Crop and rotation.
- Predict/correct anchoring.
- Magnification, undo/redo, autosave, and resume.
- Publish and revision update.
- Community contribution and review.
- Reports and moderation.
- Duplicate grouping and ranking.
- Offline download, update, corruption, and removal.
- Structured filtering and GPS-aware discovery.

### Real-device tests

- Current iPhone Safari/PWA and Android Chrome/PWA.
- Portrait and landscape.
- Airplane mode.
- Slow and interrupted cellular connections.
- Real outdoor GPS at anchors and between anchors.
- Denied location and storage permissions.

### Security tests

- Guest/public/private/owner/admin policy boundaries.
- Protected originals.
- Malicious and malformed uploads.
- Metadata stripping.
- Confirmation that live GPS never appears in network requests.

## 26. Key risks and mitigations

### Local map distortion

Risk: unusual artwork can fold or create unstable triangles.  
Mitigation: quality mesh, hard fold detection, confidence display, and distributed-anchor guidance.

### Browser offline storage

Risk: mobile browsers may evict local data.  
Mitigation: request persistent storage where supported, display explicit download health, use checksums, and make redownload easy.

### Basemap licensing and cost

Risk: satellite providers can change terms or pricing.  
Mitigation: MapLibre renderer, provider abstraction, usage limits, and cost monitoring.

### Copyright and sensitive uploads

Risk: community members may publish material they cannot share.  
Mitigation: private default, rights confirmation, reporting, unpublishing, and administrator audit trail.

### Volunteer contribution quality

Risk: well-meaning users may submit inaccurate anchors.  
Mitigation: separate contribution drafts, automated quality checks, administrator review, and contributor credit/history.

### Solo administration

Risk: moderation and review become a bottleneck.  
Mitigation: small beta, structured queues, automated checks, batch actions, and future trusted-reviewer roles only when needed.

## 27. Decision log

### D-001 — Web-first PWA

Decision: launch a mobile-friendly installable web app before native apps.  
Alternatives: native-first or simultaneous native/web.  
Reason: faster validation and one initial codebase while retaining phone GPS and offline capability.

### D-002 — Foreground GPS only

Decision: update location while the app is open; no background tracking.  
Alternatives: native background location.  
Reason: background tracking is not part of the core value and is unreliable in PWAs.

### D-003 — Device-only location privacy

Decision: never transmit or store live GPS.  
Alternatives: server history or location sharing.  
Reason: unnecessary for the product and creates avoidable privacy risk.

### D-004 — Private by default, community publishing encouraged

Decision: uploads begin private; users explicitly publish or request anchoring.  
Alternatives: all uploads public.  
Reason: protects personal, sensitive, and unlicensed material while preserving community growth.

### D-005 — Anonymous public viewing

Decision: no account required to browse, open, or download public maps.  
Alternatives: mandatory account.  
Reason: reduces friction and matches the utility-first product goal.

### D-006 — Progressive triangulated georeferencing

Decision: use global transforms for early anchors and a piecewise-affine triangulated mesh for local correction.  
Alternatives: global-only affine/projective, thin-plate spline, or server-only GDAL warping.  
Reason: predictable forward/reverse GPS math, strong local correction, immediate browser feedback, and offline operation.

### D-007 — Predict-correct-learn anchor UX

Decision: show the estimated counterpart live, let the user correct it, then recalculate after every pair.  
Alternatives: independent pin entry without prediction.  
Reason: predictions become progressively useful and reduce work while preserving exact manual control.

### D-008 — Nondestructive preparation and revision history

Decision: preserve originals, store crop/rotation metadata, autosave, and publish immutable revisions.  
Alternatives: destructive edits and mutable public files.  
Reason: safe recovery, future reprocessing, and stable offline downloads.

### D-009 — Managed split backend

Decision: Supabase for auth/database and Cloudflare R2 for raster assets.  
Alternatives: all-in-one Supabase storage or self-hosted services.  
Reason: simple access policies and geographic queries with inexpensive, egress-friendly image storage.

### D-010 — High-resolution tiled derivatives

Decision: preserve source detail and generate multi-resolution viewing data.  
Alternatives: reduce every upload to a small image.  
Reason: labels and historic details must remain readable at deep zoom.

### D-011 — Structured metadata and separate dates

Decision: use subject, style, activities, map date, upload date, and improvement date as separate fields.  
Alternatives: title and description only.  
Reason: reliable discovery when the catalog grows.

### D-012 — GPS-aware coverage discovery

Decision: prioritize maps whose coverage contains the current location and warn before opening maps outside coverage.  
Alternatives: distance to center point only.  
Reason: matches how users choose useful maps in the field.

### D-013 — Owner-only direct editing

Decision: only the owner directly edits a map.  
Alternatives: shared live editing.  
Reason: prevents accidental damage and conflict.

### D-014 — Reviewable volunteer contributions

Decision: volunteers submit separate anchor drafts reviewed by the administrator.  
Alternatives: direct edits or requiring an inactive uploader to approve.  
Reason: enables community labor without sacrificing map integrity.

### D-015 — Preserve and group duplicates

Decision: allow duplicates and group same-place, same-design, and edition relationships.  
Alternatives: reject or delete duplicates automatically.  
Reason: alternate scans and editions have continuing value.

### D-016 — Quality-based ranking with admin override

Decision: combine objective quality, report health, recency, and votes, with an administrator Recommended override.  
Alternatives: votes or upload date alone.  
Reason: prevents an old popular but poor map from burying a new high-quality one.

### D-017 — Map-native authoring gestures

Decision: both editor panes use familiar map gestures. The uploaded raster pans by pointer or touch drag, zooms around the pointer with the mouse wheel and explicit controls, and treats only a stationary click as an anchor selection. The local prototype uses attributed OpenStreetMap raster tiles without bulk downloading; the public beta will use a production basemap and satellite provider.
Alternatives: browser scrollbars, a separate pan/select mode, or immediately adopting a heavyweight deep-zoom viewer.
Reason: this removes accidental anchors and makes ordinary editing usable now while preserving a migration path to tiled deep zoom for very large source maps.

### D-018 — Local named maps before cloud accounts

Decision: retain original image Blobs, anchors, and metadata in browser IndexedDB while validating the complete local workflow.  
Alternatives: keep only one temporary draft or begin with the public backend.  
Reason: real saved maps can test editing, GPS, comparison, and recovery semantics before server permissions and synchronization are introduced.

### D-019 — Local warped comparison

Decision: reuse the saved triangulated model to render a Canvas 2D image mesh over MapLibre.  
Alternatives: adopt an IIIF renderer immediately or build server-generated GIS tiles.  
Reason: it proves rotation, scale, skew, and local rubber-sheet comparison without uploading user images or adding infrastructure.

### D-020 — Display-only editor rotation

Decision: rotate the Anchor Lab view in 90-degree steps while preserving original image pixels and anchor coordinates.  
Alternatives: rewrite the source Blob and every anchor, or use a visual transform without coordinate conversion.  
Reason: sideways maps become easier to align without risking source quality or georeference integrity.

### D-021 — Explicit private sync before publishing

Decision: add optional Supabase accounts and RLS metadata/revisions plus private R2 originals while retaining every IndexedDB map. A public-ready local map syncs as a private server draft; cloud sync alone never publishes it.
Alternatives: automatic background upload, last-write-wins replacement, or making first sync public.
Reason: this establishes the production storage path and cross-device recovery without risking local work, privacy, or catalog quality.

### D-022 — Instant explicit publishing with post-publication moderation

Decision: after private sync, an email-verified owner may explicitly make a frozen revision Public or Unlisted immediately. Public enters Discover; Unlisted uses a revocable secret link. Both enter an administrator queue without blocking use. Anonymous viewing and reporting remain account-free, while hidden maps receive an administrator-only publication hold.
Alternatives: administrator preapproval, Unlisted-only access until review, or automatically publishing every cloud sync.
Reason: someone preparing a park, trail, historical, or venue map may need to use and share it immediately. Explicit publication, safe derivatives, structured rights attestation, reports, rollback, and post-publication controls bound the risk without making one administrator a bottleneck. See [`docs/community-publishing-foundation.md`](docs/community-publishing-foundation.md).

## 28. Open implementation decisions

These do not block the product design but require prototype evidence or setup choices:

- Final product name and long-term visual identity; Field Atlas is the current working name and design.
- Production hosting platform for the existing Next.js application.
- Processing-worker runtime and queue.
- Basemap plan and production usage caps.
- Whether PMTiles fully satisfies original-orientation and overlay viewing, or an equivalent single-file pyramid is preferable.
- Maximum file, page, pixel, and decompression limits.
- Exact confidence, residual, and fold thresholds.
- Whether Google sign-in is worth adding after the implemented email/password flow is production-verified.
- Administrator notification channel for reports and volunteer submissions.

## 29. Source references

- Maprika map-creation workflow: https://www.maprika.com/make-a-map.html
- Maprika FAQ and legacy behaviors: https://www.maprika.com/faq.html
- W3C Geolocation: https://www.w3.org/TR/geolocation/
- MDN Geolocation API: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs
- MapTiler map styles: https://docs.maptiler.com/sdk-js/api/map-styles/
- GDAL warp and control-point transformations: https://gdal.org/en/stable/programs/gdalwarp.html
- D3 Delaunay triangulation: https://d3js.org/d3-delaunay/delaunay
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Service workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- PMTiles: https://docs.protomaps.com/pmtiles/
