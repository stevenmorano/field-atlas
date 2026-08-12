# Community publishing foundation

Status: core small-beta implementation is active in the configured development environment; fresh environments require the documented migrations and administrator seed
Last reviewed: 2026-08-12

## Current implementation boundary

The implemented beta path covers explicit Public/Unlisted publishing, immutable sanitized WebP copies, anonymous catalog/detail/GPS/offline/report access, generated public profiles, and administrator check/hide/restore actions. Publishing retries reuse the same request ID and unlisted secret. Exact unchanged publications stop before R2 processing. Existing local and private-cloud maps are not migrated or deleted.

The fuller design below intentionally records later hardening work as well as the implemented core. Before a larger public launch, add a global publish pause and publish throttles, background/resumable image processing, orphan-object cleanup, username-change cooldowns, account-deletion cleanup, report disposition/history UI, hidden-map administrator preview, and seeded load/concurrency/security acceptance tests. Favorites, volunteer improvements, rollback UI, and PDF/HEIC public conversion also remain later increments. These deferred items are not implied to be live by the design decisions below.

## Understanding summary

- Public maps must be usable immediately. Publication is not blocked on administrator approval.
- Every map remains private until its signed-in owner explicitly shares or publishes it.
- **Unlisted** maps are immediately available to anyone with a revocable secret link and remain outside Discover.
- **Public** maps immediately appear in anonymous Discover results and enter a post-publication review queue.
- Viewing, foreground GPS, comparison, and offline download do not require an account.
- Cloud contribution, editing, favorites, and public profiles require an account. Problem reports do not.
- Public email addresses, live GPS readings/history, viewing history, and profile/home locations are prohibited.
- Map anchor coordinates are intentionally public for a published revision because they are required to place GPS on the map.
- The first beta has one administrator. Trusted reviewer roles may be added later.

## Assumptions and constraints

- The initial audience is roughly 20-50 testers and dozens to hundreds of public maps.
- Supabase Auth/Postgres remains the identity, authorization, structured-data, and revision system.
- The existing private Cloudflare R2 bucket remains the original and public-derivative object store.
- Local IndexedDB maps and explicit private cloud sync continue to work without publication.
- Immediate publishing is an explicit product decision with a residual post-moderation risk accepted for the small beta.
- Public lists use sanitized lightweight thumbnails and pagination rather than original image files.
- Published revisions are immutable and reversible while the map exists. Moderation actions are auditable.
- Administration and report notifications are in-app for the beta; email notifications are deferred.

## Non-goals for this increment

- Global points, competitive leaderboards, monetary rewards, or popularity-based authority.
- Automatic AI moderation or administrator preapproval.
- Volunteer anchoring proposals, edits to another owner's map, and multi-user merge tooling. Their profile credit and badges are deferred with that workflow.
- Native mobile applications, background GPS, location history, navigation, or friend tracking.
- Automatic duplicate merging, map voting, and advanced recommendation ranking.

## Accepted product design

### Access model

Anonymous visitors may search and browse public maps, open unlisted links, use foreground GPS, compare maps with a basemap, download public map packages for offline use, and report problems. The current local-only map tools remain available without an account.

A signed-in, email-verified account is required to sync maps to the cloud, publish or unlist a map, save cloud favorites, receive contribution credit, and maintain a public profile. The future community-improvement workflow will also require an account. Email addresses never appear in public records or pages.

### Visibility, moderation, and effective access

A map has a requested visibility state:

- `private`: owner-only cloud access.
- `unlisted`: anonymous access through a revocable secret link; excluded from Discover and direct anonymous database listing.
- `public`: anonymous access and inclusion in Discover.

Moderation belongs to each immutable publication, not to the mutable map. A publication may be `needs_review`, `admin_checked`, `changes_requested`, or `hidden`. These internal states never stand alone in the UI; every screen displays effective access in plain language.

Effective access is always computed server-side:

- Discover returns only the current publication of maps requested as `public` whose moderation state is not `hidden`.
- Public detail routes return that same effective publication.
- Unlisted detail routes require a random 128-bit-or-stronger capability token. Only a hash is stored; the owner can rotate or revoke the token.
- A `hidden` publication is unavailable through Discover, public detail routes, unlisted tokens, asset endpoints, and offline-package endpoints.

Anonymous Supabase/PostgREST policies never grant list access to unlisted rows. A validated server route resolves the capability token and returns only the public DTO. Responses use private/no-store caching appropriate to a bearer capability so revoked links do not remain available through shared caches.

### Publication and revision flow

The map owner selects **Share or publish**, chooses Unlisted or Public, confirms a rights basis, and supplies the source/license information required for that basis. Before the final action, a consequence summary states that access begins immediately without administrator approval; identifies whether the map will be listed in Discover or available by link; shows the public username, anchors, source/license fields, and sanitized raster that will be shared; and warns that already-downloaded copies cannot be revoked. The button says **Publish publicly now** or **Create unlisted link now**, never a generic **Submit**.

The owner can follow **Change public username** before confirmation and sees the username-change cooldown before choosing it. Publication freezes the selected immutable revision inside a publication record.

The map keeps a separate `working_revision_id`; the publication identifies exactly one `published_revision_id`. Public authorization exposes only the current effective publication, its single published revision, its referenced public assets, and explicitly public profile fields. Working, conflict, superseded-unreviewed, and private revisions are never anonymously selectable.

The owner may continue editing privately. Changes do not alter the version other people are using until **Publish updated revision** is selected. Its confirmation identifies the currently shared revision and selected replacement, including image-changed state, anchor counts, timestamps, and changed metadata, and links to a compare preview. A new publication becomes visible immediately, enters `needs_review`, and preserves prior publications for rollback. Reports always reference a publication ID.

Administrator hiding has precedence over owner publishing. The administrator action is labeled **Hide map and block new publishing**, requires a reason, and warns that it affects the whole map rather than only one revision. Hiding sets an administrator-only map-level publication hold in addition to hiding the current publication. Effective-access queries require that the map has no hold, and owner publish/unpublish operations fail while the hold exists. Only an administrator restore transition clears it.

The owner sees a persistent **Hidden by administrator** banner with the reason, affected actions, and an in-app restoration-request path; disabled controls explain the hold instead of failing silently. Unpublishing changes access without deleting the local copy, original object, anchors, metadata, or history. Featured placement is a separate administrator action.

### Immediate-publication safeguards

Instant publication is limited to verified accounts and supported sanitized raster content. Per-account and per-installation publish rate limits prevent bulk flooding. Basic filename, declared type, magic-byte, decoded-dimension, pixel-count, and payload limits run before a publication can become effective. The administrator navigation exposes a persistent needs-review/report count and an emergency global publication pause.

These safeguards reduce but do not eliminate the risk of abusive content being public before human review. The beta explicitly accepts that residual risk to preserve immediate use. Credible ownership or prohibited-content complaints receive priority and can be hidden nondestructively. Reports alone do not automatically hide a map.

### Rights attestation and takedown

The uploader selects one basis: original work/authorized photograph, explicit permission, public domain, or a named open license. A source URL and license are required for public-domain/open-license claims and requested when available for permission claims. The UI states that attestation does not prove ownership and that the uploader remains responsible for sharing rights.

A rights record is frozen with each publication. Administrators receive a consistent view of the attestation and source. A credible complaint can hide the publication immediately while the record and evidence remain available for review.

### Public image and package safety

The unchanged uploaded original remains private in R2. Publication creates or reuses two sanitized derivative objects: a capped thumbnail for Discover/profile pages and a high-quality public raster for viewing/offline use. Decoding and re-encoding remove EXIF and other embedded metadata, reject unsupported/invalid payloads, and prevent browsers from receiving the private original by default.

Direct browser uploads land under a unique quarantine key and can never become a public asset in place. A trusted server process streams the quarantine object, verifies its content hash, magic bytes, decoded dimensions/pixel count, and successful decode, then writes sanitized derivatives to new content-addressed finalized keys. Published keys are immutable and non-overwritable through client credentials. Failed or expired quarantine objects are never referenced by an effective publication.

The public derivative supports the beta's safe raster formats and enforces decoded pixel and output-size limits. SVG, PDF, HEIC, and other preparation formats remain private inputs until a separate trusted conversion pipeline exists. Public asset downloads use short-lived, publication-authorized URLs with rate limits and attachment-safe headers.

### Anonymous reporting

Every effective public or unlisted map exposes **Report a problem** without authentication. Categories include inaccurate GPS/anchors, poor image quality, incorrect location/year/description, duplicate map, copyright or ownership concern, inappropriate content, and other.

A report references the exact publication and may include an optional note. Default grouping uses publication ID plus category; administrators can merge related issues manually. Reports on different revisions remain distinguishable.

Anonymous rate limiting uses a server-side HMAC of the requester address with a rotating daily secret; raw addresses are not stored, and the derived key expires after the abuse window. A honeypot, body limits, and per-publication/category limits supplement it. Signed-in reporters may receive credit for a confirmed useful report; anonymous reports remain anonymous.

### Profiles and recognition

Account creation assigns a unique friendly username such as `TrailFox-4821`. A member may change it subject to uniqueness, basic content rules, a change cooldown, and administrator override. Public profiles initially expose only a generated avatar, effective public maps, administrator-checked publication count, and the small publication milestones **First Public Map** and **Five Maps Shared**.

Newly published work may be labeled **New**; milestones count only administrator-checked work. **Admin checked** means only that the site administrator completed the beta review checklist; it is not a guarantee of positional accuracy, map quality, safety, ownership, or legal status. Improvement/report badges and contributor lists are deferred until those contribution workflows exist. No profile includes email, private maps, live GPS, viewing history, or a profile/home location.

### Initial screens

- **My Maps:** Share or publish, visibility choice, consequence summary, rights basis/source, effective-access label, share link, **Create new link**, **Stop sharing**, and publish-updated-revision controls. Creating a new unlisted link immediately invalidates the old link. Stopping sharing returns the map to Private. Neither action can recall an already-downloaded package.
- **Discover:** immediate anonymous public results with sanitized thumbnails, year, type, location, uploader, anchor count, and a plain **New** or **Admin checked** label with the non-guarantee explanation. Unlisted maps are excluded.
- **Public map page:** anonymous viewer, foreground GPS, compare, offline package, uploader-profile link, and report control.
- **Moderation:** administrator-only unread count and queues for new publications, updated revisions, reports, requested changes, and hidden maps.
- **Profile:** username, generated avatar, effective public maps, administrator-checked publication count, and initial publication milestones.

### User-facing status and recovery

The interface always pairs visibility with moderation consequences:

- **Listed publicly · awaiting admin check** — usable and in Discover now.
- **Listed publicly · updates requested · still visible** — remains accessible unless the administrator separately hides it.
- **Shared by link · awaiting admin check** — usable through the link and absent from Discover.
- **Admin checked · not an accuracy or ownership guarantee** — review checklist completed.
- **Temporarily hidden by administrator** — unavailable and blocked from republishing until restored.

Publication progress uses explicit resumable stages: **Checking map**, **Preparing safe public copy**, **Uploading**, **Publishing**, and **Shared**. Preflight rejects unsupported type/size/pixel count before upload. Rate limits show when to retry; a global pause says existing maps remain available and publishing is temporarily unavailable. Processing/network failures preserve the private map and existing public revision and offer a safe idempotent **Retry**. Leaving the page does not discard completed stages.

A stale-publication conflict keeps all private edits, identifies that another tab/device changed the public version, and offers **Review latest public version** before retrying. Anonymous report submission confirms receipt without promising follow-up. Duplicate/throttled reports explain that the issue is already recorded or when another attempt is allowed; network failure keeps the note in the form for retry. Anonymous reporters are told they cannot track the outcome.

## Technical design

### Records and data boundaries

Supabase stores account identity, public profiles, maps, immutable revisions, asset metadata, anchor/metadata payloads, publication records, requested visibility, moderation state, rights attestations, reports, milestone records, administrator roles, and the moderation log. Cloudflare R2 stores private originals and sanitized public derivatives. Foreground GPS readings never enter either service.

The existing `maps.current_revision_id` becomes or is treated as `working_revision_id`; a publication record references one `published_revision_id`, rights record, derivative set, moderation state, and publication timestamp. `maps.current_publication_id` identifies the effective publication. Public queries never infer access from the working revision.

Public revision metadata is schema-versioned and fail-closed. Publication accepts only an allowlist needed by the viewer and catalog: public map/publication IDs, title, description, depicted year/date, general place label, map/type/activity classifications, intrinsic dimensions, validated anchor/transform payload, public derivative references, rights/source fields, uploader username, and review state. Unknown keys are rejected or omitted and are never serialized from arbitrary private metadata JSON. Email, private filenames/object keys, private notes, sync state, conflict details, and working-revision fields are excluded from every public DTO.

Account deletion is an explicit exception to ordinary rollback retention: it immediately removes public access, pseudonymizes required audit entries, and schedules owned private/public objects and records for deletion after a 30-day recovery window. A daily cleanup job retries failed Postgres/R2 deletion throughout the window and exposes failures to the administrator. Completion writes a non-identifying tombstone with counts/checksums sufficient to prove cleanup without retaining the deleted content. Published work may be intentionally transferred to a community custodian before deletion in a later workflow, but is never silently retained against the owner's deletion request.

### Authorization and administration

Row-level security remains deny-by-default. The activation migration removes the cloud-foundation `revisions_public_select` and `assets_public_select` policies, revokes anonymous direct `SELECT` on raw `maps`, `map_revisions`, and `map_assets`, and replaces helpers whose public decision depends only on `maps.current_revision_id`.

Anonymous catalog/detail reads use narrowly scoped, security-reviewed server APIs or allowlisted database functions that return only the explicit effective-public DTO. Unlisted access uses the capability route. Owners manage private maps and publication requests only through narrowly scoped operations. Asset authorization checks the map-level hold and exact effective publication immediately before issuing a short-lived URL.

Existing client-executable asset-completion functions are not trusted for publication. The activation migration revokes authenticated execution of `complete_map_asset` or limits it to private-sync readiness only. Only the trusted server validator can mark quarantine content verified, create finalized derivative records, and attach those immutable records to a publication. Client-supplied readiness, MIME type, dimensions, object key, or checksum is never sufficient for public access.

Administrative membership lives in a server-controlled `site_roles` table seeded with the owner's Supabase user UUID. Client roles cannot insert, update, or delete role rows. Server operations recheck the role. The append-only moderation log records actor, action, target publication/map, reason, and timestamp; ordinary users and administrators cannot rewrite or delete log entries through application APIs. Role provisioning/revocation remains an operator action for the beta.

### Transaction and concurrency invariants

- Every publish request includes a unique idempotency key, map ID, selected base revision, requested visibility, and expected prior publication ID.
- A database transaction locks the map row, verifies ownership/base state, creates or reuses one publication for the idempotency key, and atomically advances `current_publication_id` only if the expected prior publication still matches.
- An administrator hide wins over concurrent owner publish/unpublish. Hidden state requires an administrator restore transition.
- R2 derivative preparation completes and is verified before the transaction can make a publication effective.
- Failed or abandoned object preparation leaves the existing publication unchanged. Unreferenced objects are eligible for delayed garbage collection after a safety window.
- Repeat requests return the original result. Conflicting expected-publication values return a conflict and never silently replace the public version.
- Rollback creates an audited transition to a prior valid publication; it does not mutate historical rows.

### Query and retention bounds

- Discover uses cursor pagination with 24 cards per page; moderation and report queues use 50 rows per page.
- Indexes cover effective public catalog ordering/filter fields, `current_publication_id`, publication moderation state/creation time, report status/creation time, report publication/category grouping, owner map listing, and unique normalized usernames.
- Unreferenced quarantine/finalization objects become garbage-collection candidates after seven days. Referenced revisions and derivatives are retained for rollback while the map exists.
- Before beta growth, seeded acceptance checks require a 24-card catalog query and 50-row moderation/report queue to complete within one second at 10,000 maps/reports on representative Supabase infrastructure.

## Verification plan

- Verify private, tokenized-unlisted, public, and hidden access with anonymous, owner, other-member, and administrator sessions.
- Prove unlisted records cannot be enumerated through anonymous database APIs and that token rotation/revocation invalidates prior links and caches.
- Prove public policies expose only the current publication's one revision/assets and never working or conflict revisions.
- Prove legacy anonymous raw-table policies/functions are removed and arbitrary private metadata cannot enter a public DTO.
- Verify immediate anonymous Discover visibility, review-queue insertion, administrator-hide precedence, and emergency publication pause.
- Verify a map-level publication hold blocks new owner publications until administrator restoration.
- Verify idempotent publish retries, concurrent publish/unpublish/hide races, partial R2/database failure, garbage-collection safety, rollback, and checksum reuse.
- Verify quarantine isolation, server-side hash/decode checks, non-overwritable finalized keys, safe raster decoding, pixel limits, metadata stripping, thumbnail/public-raster generation, attachment headers, and download rate limits.
- Verify anonymous report grouping/rate limits without retained raw addresses and without automatic takedown.
- Verify rights-basis validation, complaint hiding, username privacy/uniqueness, administrator-checked-only milestones, and account-deletion cleanup.
- Verify consequence summaries, effective-access labels, non-guarantee wording, resumable progress, actionable failure states, hidden-map explanation, update comparison, and anonymous-report confirmation.
- Verify desktop/mobile layouts, keyboard navigation, accessible status labels, and interruption recovery.
- Confirm existing IndexedDB maps, private sync, GPS privacy, compare, and portable backups remain unchanged.

## Decision log

| Decision | Alternatives considered | Objection and resolution | Status |
| --- | --- | --- | --- |
| Immediate post-publication review | Preapproval; unlisted-only until approval | Abuse can remain public before one administrator reviews it. Accepted as a conscious small-beta risk; added verified-account/rate/content gates, persistent queue count, emergency pause, and priority takedown while preserving immediate legitimate use. | Accepted with residual risk |
| Separate requested visibility and publication moderation | One combined publication status | A hidden public row could remain readable. Added one server-side effective-access predicate used by Discover, detail, assets, offline packages, and tokens. | Accepted |
| Secret capability route for Unlisted | Anonymous RLS on unlisted rows; public-but-unindexed flag | RLS cannot prove a client knows a link and could allow enumeration. Added high-entropy revocable tokens, stored hashes, no anonymous table listing, and non-shared caching. | Accepted |
| Separate working revision and immutable publication | Live public edits; lock all editing; reuse only `current_revision_id` | Existing schema/policies could expose private/conflict revisions. Added explicit publication records/current publication pointer and public policy limited to exactly the published revision/assets. | Accepted |
| Sanitized public derivatives | Serve private original directly; postpone thumbnails | Large originals, EXIF, unsafe formats, and list performance were underdefined. Private original stays private; verified sanitized thumbnail and public raster are required before effective publication. | Accepted |
| Transactional idempotent publication | Best-effort sequential calls | Retry/race behavior was asserted but undefined. Added idempotency keys, expected-publication compare-and-swap, row locking, verified derivatives, hide precedence, and delayed orphan cleanup. | Accepted |
| Deletion removes public access and data | Preserve all public history after account deletion; forbid deletion | Cascade behavior conflicted with rollback claims. Defined account deletion as an explicit retention exception with immediate unpublish, pseudonymized audit, recovery window, and scheduled object deletion. | Accepted |
| Structured rights attestation | Generic checkbox; mandatory administrator approval | A checkbox cannot prove rights. Added explicit rights bases, conditional source/license requirements, frozen attestations, responsibility language, and complaint-based hiding without claiming legal verification. | Accepted |
| Public anchor coordinates; private user location | Vague prohibition on precise locations | Map anchors are intentionally precise and required for GPS transformation. The privacy boundary now prohibits user GPS/history/profile location and strips public-image metadata, not map georeferencing coordinates. | Accepted |
| Anonymous reports | Account-required reports | Rate/grouping behavior was vague. Added publication/category grouping, rotating-HMAC rate keys, expiry, honeypot/body limits, and manual cross-revision merge. | Accepted |
| Minimal initial profiles/milestones | Full contribution badges now; no recognition | Improvement badges conflicted with deferred collaboration and added premature scope. Initial profiles now count only administrator-checked publications; contributor/report badges wait for their workflows. | Accepted |
| Server-controlled single administrator role | Client profile flag; undefined protected role | Provisioning and audit rules were vague. Added operator-seeded non-client-writable roles, server rechecks, and append-only moderation audit behavior. | Accepted |
| Replace legacy anonymous policies with allowlisted public APIs | Continue broad raw-table RLS; serialize arbitrary revision JSON | Existing policies could expose every revision and future private metadata. Activation must revoke raw anonymous reads/remove legacy policies, replace current-revision helpers, validate a versioned public schema, and return only an allowlisted DTO. | Accepted |
| Persistent map-level publication hold | Hide only the current publication | A new owner publication could bypass publication-scoped hiding. Administrator hide now sets a map-level hold checked by every access and publication transition. | Accepted |
| Trusted quarantine-to-finalized asset pipeline | Let authenticated clients complete publishable assets | Existing completion trusted client state too far. Public assets now require trusted streaming/hash/decode verification and new immutable finalized derivative keys. | Accepted |
| Bounded cleanup and queries | Leave pagination, indexes, cleanup, and deletion timing implicit | Added 30-day account-deletion recovery/retry/evidence, seven-day orphan collection, fixed cursor page sizes, required indexes, and small-beta query acceptance checks. | Accepted |
| Explicit publish consequence summary | Generic submit confirmation | Immediate access and irreversible downloads were too easy to misunderstand. Final actions now name Public or Unlisted and enumerate the exact public data and consequences. | Accepted |
| Plain effective-access labels and **Admin checked** | Show raw visibility/moderation states; use **Reviewed** | Raw states were ambiguous and **Reviewed** implied accuracy/legal verification. Labels now state actual access, whether still visible, and the limited meaning of an administrator check. | Accepted |
| Resumable staged publication and actionable recovery | Spinner plus generic failure | Unsupported content, pauses, limits, processing failures, and stale revisions lacked recovery. Added explicit stages, preflight, safe retry, preserved work, conflict review, and visible retry timing. | Accepted |
| Explain map-level holds and updated revisions | Silent disabled controls; publish latest without comparison | Owners and administrators could misunderstand scope or replacement. Hide now requires a reason/scope warning; owners see the hold/restoration path; updated publication summarizes and previews differences. | Accepted |
| Clear anonymous report and attribution expectations | Silent report success; implicit public username | Reports now confirm/retain/retry appropriately and state they cannot be tracked anonymously. Publishing shows the exact public username and its cooldown before confirmation. | Accepted |
| Supabase plus R2 | R2-only JSON; all-Supabase storage; Cloudflare D1/Workers/R2 | Reuses implemented RLS/auth/revision behavior and keeps high-resolution objects in R2. | Accepted |

## Structured review record

### Skeptic / Challenger

Disposition: original draft blocked. Fourteen objections were reviewed. Access enforcement, unlisted enumeration, revision isolation, immediate-publication exposure, asset safety, concurrency, account deletion, rights claims, privacy boundaries, contribution scope, report controls, moderation ownership, profile scope, and administrator role controls were all accepted and resolved in this revision. Immediate post-publication availability remains a deliberately accepted product risk with bounded beta safeguards rather than a claim of zero exposure.

### Constraint Guardian

Disposition: intermediate draft blocked until four enforcement gaps were resolved. The design now explicitly removes legacy anonymous revision/asset policies and current-revision helpers, uses allowlisted public DTOs, persists an administrator-only map hold, and requires trusted quarantine-to-finalized asset verification. Non-blocking deletion, indexing, pagination, garbage-collection, cost, and performance concerns received concrete small-beta bounds and acceptance checks.

### User Advocate

Disposition: intermediate draft blocked until publication consequences, effective-access status, limited review meaning, recovery paths, map-wide hold behavior, and updated-revision confirmation became explicit. The design now uses action-specific confirmation, plain access labels, **Admin checked** disclaimers, resumable progress/retry, visible hold reasons/restoration, revision comparison, report confirmation, and public-username disclosure. Premature contributor terminology was removed from the initial beta UI.

### Integrator / Arbiter

Disposition: **APPROVED**. The Understanding Lock is recorded, reviewers were invoked sequentially, every objection is accepted and resolved in the decision log, no blocker remains, and the scope preserves the immediate-publication goal. Preapproval and unlisted-only publication remain rejected because they contradict that locked goal; the underlying exposure risk remains explicitly accepted with bounded beta safeguards.
