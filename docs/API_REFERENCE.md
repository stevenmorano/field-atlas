# Application API reference

Status: implemented browser-application API
Last reviewed: 2026-08-12

These Next.js App Router handlers support the Field Atlas web application. They are not yet a versioned third-party API. Request and response contracts may evolve with the beta.

## Conventions

- JSON failures use `{ "error": "human-readable message" }` where possible.
- Authenticated routes verify the Supabase cookie session server-side.
- Owner access is additionally constrained by Postgres row-level security and narrow database functions.
- Public and Unlisted reads return allowlisted publication DTOs rather than raw tables.
- Unlisted `share` query values are bearer secrets. Never log, persist in analytics, or include them in public referrers.
- Private and Unlisted responses use non-shared cache headers. Public map data is briefly cacheable.

## Authentication callback

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /auth/callback?code=...&next=/path` | One-time Supabase authorization code | Exchanges the code for the cookie session and redirects to a safe local path. Invalid/expired codes redirect to `/auth/error`. |

## Private cloud endpoints

| Method and path | Access | Input | Result |
| --- | --- | --- | --- |
| `POST /api/cloud/assets/presign` | Signed-in owner | File name, normalized raster MIME type, byte size, SHA-256, width, height | Creates/reuses a private asset record and returns a short-lived R2 `PUT` URL when upload is required. |
| `POST /api/cloud/assets/[assetId]/complete` | Signed-in asset owner | Path asset ID | Verifies R2 content length/type and marks the object ready. |
| `GET /api/cloud/assets/[assetId]` | Signed-in asset owner through RLS | Path asset ID | `307` redirect to a short-lived private R2 `GET` URL with `private, no-store`. |
| `GET /api/cloud/maps` | Signed-in owner | None | Lists current account map summaries without image bytes. |
| `POST /api/cloud/maps` | Signed-in owner | Map/revision payload, asset ID, content fingerprint, optional base revision | Creates/reuses an immutable revision. A stale base returns `409` and preserves the incoming conflict. |
| `GET /api/cloud/maps/[mapId]` | Signed-in owner through RLS | Path map ID | Returns the current revision, anchors, metadata, and verified asset metadata for explicit device download. |

Private sync accepts JPEG, PNG, and WebP objects up to the limits in `cloud-map-contract.ts`. HEIC/HEIF may work locally through browser decoding but are not a supported public-processing input.

## Community read and profile endpoints

| Method and path | Access | Input | Result/cache |
| --- | --- | --- | --- |
| `GET /api/community/maps?q=&subject=&before=` | Anonymous | Bounded search, optional subject, optional cursor | Up to 24 effective Public summaries. |
| `GET /api/community/maps/[mapId]?share=TOKEN` | Anonymous | Public map ID; token only for Unlisted | Effective frozen publication DTO. Public: `max-age=60`; Unlisted: `private, no-store`. |
| `GET /api/community/assets/[assetId]?variant=map|thumbnail&share=TOKEN` | Anonymous | Effective public asset and optional token | Authorized `307` redirect to short-lived sanitized WebP delivery. |
| `GET /api/community/profiles/[username]` | Anonymous | Public username | Public profile, effective Public contributions, and milestones. |
| `GET /api/community/profile` | Signed-in member | None | Own username, bio, avatar seed, and optional staff role. |
| `PATCH /api/community/profile` | Signed-in member | Username and bio | Updates allowlisted public profile fields. Email is never returned. |

## Publishing endpoints

| Method and path | Access | Input | Result |
| --- | --- | --- | --- |
| `GET /api/community/maps/[mapId]/status` | Signed-in owner | Path map ID | Current synced/published revision, moderation hold, and frozen sharing settings. |
| `POST /api/community/maps/[mapId]/publish` | Signed-in owner | Visibility, rights basis, source/license/credit, optional Unlisted token, idempotency key, expected publication ID | Sanitizes derivatives and atomically creates the current publication. Runs in the Node runtime with a 60-second handler limit. |
| `POST /api/community/maps/[mapId]/unpublish` | Signed-in owner | Expected current publication ID | Ends anonymous access without deleting local/private work. |

Publication requires at least two anchors and the latest synced revision. Idempotent retries recover the original result. An exact current revision with identical sharing fields returns `409` before any R2 read/write so accidental republishing cannot create duplicate public images.

## Reports and moderation

| Method and path | Access | Input | Result |
| --- | --- | --- | --- |
| `POST /api/community/maps/[mapId]/reports` | Anonymous | Publication ID, category, optional note/token, honeypot | Adds a bounded report for the exact effective publication. Uses a rotating HMAC abuse token, not a stored raw address. |
| `GET /api/community/moderation` | Staff | None | Returns up to 50 queued publications with grouped reports. |
| `POST /api/community/moderation` | Staff | Publication ID, action, reason | Applies `admin_checked`, `changes_requested`, `hidden`, or `restored` through the audited database function. |

## Primary contract modules

- `src/features/cloud/cloud-map-contract.ts`: upload, sync, download, hashing, and DTO validation.
- `src/features/community/community-contract.ts`: publication, report, public-map, profile, and unchanged-publication contracts.
- `src/lib/cloud/cloud-api.ts`: shared authentication and error mapping.
- `src/lib/community/community-server.ts`: publishing, sanitized image creation, idempotency, deduplication, and anonymous report tokens.
- `src/lib/community/community-data.ts`: allowlisted public list/detail mapping.

## Security invariants

1. R2 credentials and report secrets stay server-only.
2. Cloud sync never implies publication.
3. Public access resolves one effective immutable publication and never exposes working/conflict revisions.
4. Private originals never use public-delivery endpoints.
5. Live GPS never enters any request contract.
6. Map anchors are intentionally public only within an effective published revision because client-side positioning requires them.

See [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATA_AND_PRIVACY.md`](DATA_AND_PRIVACY.md), and [`community-publishing-foundation.md`](community-publishing-foundation.md).
