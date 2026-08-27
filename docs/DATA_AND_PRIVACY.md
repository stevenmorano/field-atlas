# Local data and privacy

Status: current implementation  
Last reviewed: 2026-08-15

## Storage model

Field Atlas currently uses the browser's IndexedDB database `field-atlas-local` at schema version 3.

| Store | Key | Cardinality | Purpose |
| --- | --- | --- | --- |
| `anchor-drafts` | `current` | One active record | Resume unfinished or actively edited anchor work |
| `saved-maps` | UUID | Multiple records | Named maps shown in My Maps |
| `cloud-sync-state` | Map UUID | At most one per synced map | Last accepted account/revision/fingerprint plus the acknowledged local timestamp; never image or GPS data |

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

Mesh quality warnings, including the highlighted folded triangle and its anchor numbers, are derived locally from these pairs. The diagnostic overlay does not create a separate record or transmit additional location data.

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

Metadata contains title, description, place name, subject, visual style, map date kind/year, activity tags, source, and private/public-ready intent. Private sync alone never makes it anonymously visible. A separate explicit Share action freezes and publishes one synced revision.

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

- sort the public Discover catalog (or unconfigured sample fallback) after a one-shot request; or
- project a live viewer reading onto a saved image.

The current application does not write live coordinates, accuracy readings, viewing history, or traveled paths to IndexedDB, URLs, analytics, logs, or an application server. The saved anchor coordinates are map calibration data, not a user's live location.

The viewer starts `watchPosition` only after **Find me** and clears it when hidden or unmounted.

## Network and cloud boundary

Without configuration, user image Blobs, metadata, and anchors are not uploaded. With an account, **Finish map** or **Save progress to cloud** explicitly sends:

- the unchanged original image to the owner's private R2 key;
- structured map metadata and anchor pairs to RLS-protected Postgres tables; and
- image dimensions, MIME type, byte count, and SHA-256 checksum used to verify the transfer.

Live coordinates, accuracy readings, viewing history, and traveled paths are excluded. Other network requests may go to:

- the Next.js development/production web origin;
- OpenStreetMap raster tiles;
- Esri World Imagery; or
- a configured MapLibre style and its referenced providers.
- Supabase Auth/Postgres after account sign-in; or
- Cloudflare R2 through short-lived single-object URLs during explicit cloud checkpoint/download.

The production service worker caches same-origin application resources, not a complete cross-origin basemap.

## Data-loss risks

IndexedDB is durable browser storage, not a backup. Data may be lost if the user clears site data, removes the browser profile, uses private-browsing storage, changes origin, or the browser evicts storage. Configured account backup creates and restores a separate copy when a map is finished or the user chooses **Save progress to cloud**; it is checkpoint-based rather than continuous background upload.

Field Atlas now provides a portable, versioned `.fieldatlas` backup containing active saved maps, exact original image bytes, anchors and metadata, plus the active unfinished draft. Import validates the package before writing, skips exact duplicates, preserves divergent same-ID records as separate imported copies, and keeps the current draft by default.

The downloaded file is still user-managed and is never automatically uploaded to an account. Losing browser data and every exported copy can still lose any maps that were never explicitly synced.

## Portable backup privacy boundary

Backup creation and import run locally. The package is a binary container with a versioned JSON manifest and SHA-256-addressed raw image payloads; images are not resized, recompressed, or base64-expanded. The package excludes live GPS readings, location history, browsing history, and secrets. Because it may contain private maps and filenames, treat the file as sensitive data.

## Public server boundary

Configured community publishing supports explicit instant Public or tokenized Unlisted access, post-publication administrator checks, anonymous reports, generated profiles, allowlisted public DTOs, and sanitized public derivatives. Large sources are decoded within a bounded 200-megapixel processing limit and reduced only in the shared high-quality derivative to a maximum 6,000-pixel long edge; the unchanged original remains private in R2. Reduced publications store image-space anchor coordinates for the derivative, while the private revision and original coordinates remain unchanged. Public DTOs necessarily include the published map's anchor coordinates because GPS projection depends on them, but exclude email, private filenames/keys, working revisions, live GPS, viewing history, and traveled paths. Anonymous report throttling stores a rotating HMAC token rather than a raw network address. Public viewing remains independent of a signed-in private-cloud session; an unavailable private-cloud lookup does not expand the public data boundary. See [`community-publishing-foundation.md`](community-publishing-foundation.md) and [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md).

Unlisted URLs are bearer capabilities: anyone who receives the complete secret link can open that frozen publication until it is superseded, unpublished, hidden, or otherwise revoked. Store and transmit those links accordingly. The token is hashed before database storage and must never be placed in logs or committed documentation.

## Secrets and repository boundary

`.env.local` is ignored by Git. Supabase project URLs and browser publishable keys are client configuration, while R2 credentials and `REPORT_FINGERPRINT_SECRET` are server-only secrets and must never use a `NEXT_PUBLIC_` prefix. Portable `.fieldatlas` files, local recovery JSON, public share links, and browser database exports may contain private material and should not be committed. See [`CLOUD_SETUP.md`](CLOUD_SETUP.md) and [`OPERATIONS.md`](OPERATIONS.md).
