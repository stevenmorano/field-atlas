# Cloud account and sync foundation

Status: private-sync foundation implemented and community successor activated in the configured development environment
Last reviewed: 2026-08-12

## Understanding summary

- Field Atlas remains usable without an account or network connection.
- Accounts add private cloud backup and cross-device access; they do not replace IndexedDB.
- Existing local maps are copied only after the owner explicitly chooses **Sync to cloud**.
- Supabase Auth and Postgres hold identity, ownership, metadata, anchors, and immutable revisions.
- Cloudflare R2 holds original high-resolution image files without recompression.
- Live GPS readings, viewing history, and traveled paths never enter the cloud sync payload.
- Anonymous public viewing, publishing, and moderation are implemented by the additive successor migration.

## Assumptions

- The first beta is small enough for one Supabase project and one private R2 bucket.
- Email/password is the beta authentication method. Additional identity providers can be added later.
- A map image may be as large as 100 MB; direct presigned uploads avoid routing that payload through Next.js.
- Upload and download URLs are short-lived bearer credentials and are never persisted in IndexedDB or Postgres.
- A local map ID is already a UUID and can remain the stable cloud map ID.
- The application continues to work normally when cloud environment variables are missing.

## Accepted design

### Authentication

Supabase SSR clients store the session in cookies. Server authorization uses a verified user lookup or claims check; browser-only visibility checks are never treated as authorization. The Account page offers email/password registration, sign-in, and sign-out. Anonymous users can continue using every current local feature.

### Data and authorization

Postgres stores `maps`, `map_revisions`, and `map_assets`. Every table has row-level security. Owners can read their own records and write through narrow functions. The successor migration revokes prototype anonymous raw-table reads; anonymous viewers receive only allowlisted effective-public DTOs. New syncs remain private even when local metadata says `public-ready`.

Each sync creates or reuses an immutable revision. The client sends the revision it started from. If the remote current revision changed first, the server preserves the incoming work as a conflict revision without replacing the current version.

### Image transfer

The browser hashes the original Blob, requests a short-lived, content-type-restricted R2 `PUT` URL, uploads directly, and asks the server to verify the object before attaching it to a revision. Downloads use short-lived authorized `GET` URLs. R2 credentials remain server-only. The bucket must allow the application origins through CORS.

### Local/cloud boundary

Cloud sync state is stored in a new IndexedDB object store separate from saved map records. Syncing never deletes or rewrites the local image, metadata, or anchors. A cloud-only map can be explicitly downloaded to the device, after which the existing viewer, compare, and editor flows operate on the local copy.

### Public publishing boundary

The successor increment implements explicit instant Public or tokenized Unlisted publication followed by administrator checking. It freezes one revision, serves only sanitized derivatives, isolates Unlisted access behind a secret token, adds Discover/profiles/reports, and replaces provisional public policies before activation. See [`community-publishing-foundation.md`](community-publishing-foundation.md).

## Failure behavior

- Missing cloud configuration shows setup guidance and leaves local features enabled.
- Failed upload or database sync leaves the local map untouched and retryable.
- A stale-device conflict is reported instead of silently overwriting the remote current revision.
- Invalid file metadata, unsupported content types, oversized payloads, and unauthenticated requests are rejected before a presigned URL is issued.
- A failed cloud download never replaces an existing local map.

## Decision log

- **Private by default:** chosen to match the product promise and prevent accidental publication.
- **Local copy retained:** chosen so cloud work cannot endanger existing browser maps or offline use.
- **Supabase plus R2:** chosen over an all-in-one store for strong RLS plus inexpensive high-resolution raster storage.
- **Direct presigned transfer:** chosen over proxying image bytes through Next.js for speed and hosting-limit safety.
- **Immutable revisions:** chosen over last-write-wins to preserve work from multiple devices.
- **Publishing separated from sync:** the private foundation stayed safe while the complete reports, moderation, profiles, asset-sanitization, and catalog workflow was added in the successor migration.

## Validation

- Unit-test cloud payload validation, stable hashing, local sync-state storage, and cloud DTO conversion.
- Verify local-only startup and all existing IndexedDB workflows with no cloud variables.
- Verify sign-in, first sync, repeat sync, conflict response, cloud listing, and download against configured services.
- Run lint, TypeScript checking, the full test suite, production build, dependency audit, and desktop/mobile browser regression checks.
