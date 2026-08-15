# Field Atlas

Field Atlas is a web-first application for putting live browser GPS on almost any raster map: historic atlases, trail signs, illustrated zoo maps, amusement-park maps, aerial photographs, and maps whose scale or orientation differs from modern geography.

The current build is a local-first functional beta with account-gated creator tools and community publishing. Anonymous visitors can browse public maps, use GPS, and compare; a signed-in account is required before upload, anchoring, editing, map creation, cloud backup, or publishing. Configured cloud services add private cross-device copies plus anonymous Public/Unlisted sharing.

## Current capabilities

- Upload JPEG, PNG, WebP, HEIC, or HEIF files supported by the browser decoder.
- Pan, deep-zoom (up to 3200%), and rotate the uploaded map in 90-degree steps while anchoring.
- Match numbered image landmarks to Street, Satellite, or Hybrid MapLibre basemaps.
- Improve predictions progressively with similarity, affine, and triangulated piecewise-affine transforms.
- Undo, redo, delete, clear, and resume anchor work with debounced IndexedDB autosave.
- Finish a map with structured title, place, date, subject, style, activity, source, and visibility metadata.
- Save drafts automatically on the device, back up finished maps, and create additional cloud checkpoints from My Maps.
- Keep multiple high-resolution maps in the browser-local My Maps library.
- See local and cloud-only completed maps together, open or Compare them online, optionally save a copy for offline use, or remove only the local offline copy.
- Reopen a saved map for additional anchors without creating an accidental duplicate.
- View a saved image at full resolution and project foreground browser GPS onto it with an accuracy area.
- Compare a saved map as a warped, adjustable-opacity overlay on a live basemap.
- Export every active saved map plus the unfinished draft to one verified `.fieldatlas` backup, then preview and restore it without overwriting existing work.
- Sign in with email/password before creator work and explicitly checkpoint private, revisioned Supabase and Cloudflare R2 storage.
- List account maps on another device and download a verified original image plus its metadata and anchors into that browser.
- Publish an explicitly selected synced revision as Public or tokenized Unlisted without waiting for preapproval.
- Recognize an already-published revision and avoid duplicate publication records or duplicate public image processing.
- Keep private originals private while serving sanitized high-quality and thumbnail WebP copies.
- Browse real public maps in Discover, open them with GPS without an account, save them on the current device for offline use, and report problems anonymously.
- Use generated public usernames, contribution profiles, simple milestones, and an administrator post-publication queue.
- Install the production build as a PWA with a small offline application shell.

Discover falls back to four sample records when community services are not configured. The configured development environment has completed account, sync, Public/Unlisted publishing, anonymous viewing/reporting, profile, GPS, publication-deduplication, and the complete administrator moderation lifecycle. The beta-readiness gate is tracked in [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md); desktop/mobile interaction verification, the changed-revision public update workflow, persistent community favorites, and production verification remain before broader invitations. PDF conversion, cropping, and full production offline packages remain future work.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Useful routes:

| Route | Purpose |
| --- | --- |
| `/` | Community Discover catalog (or samples when unconfigured) and foreground location sorting |
| `/anchor` | Resume the current Anchor Lab draft |
| `/anchor/new` | Safely start a fresh map after checking for an active draft |
| `/my-maps` | Search and open locally saved maps |
| `/account` | Create an account, sign in, and edit the public username/profile |
| `/about` | Learn why Field Atlas exists and how creator and visitor workflows differ |
| `/how-to-use` | Beginner walkthrough for browsing, GPS, Compare, anchoring, saving, and sharing |
| `/changelog` | Plain-language record of user-facing features and improvements |
| `/maps/[mapId]` | Local or anonymous public high-resolution GPS viewer |
| `/maps/[mapId]/compare` | Warped overlay comparison |
| `/profiles/[username]` | Public mapmaker contributions and milestones |
| `/moderation` | Administrator post-publication queue |

## Basemaps

Without configuration, the prototype uses attributed OpenStreetMap raster tiles for Street, Esri World Imagery for Satellite, and a translucent OSM-over-imagery Hybrid mode. These modes require internet access unless the browser already cached the needed resources and remain subject to each provider's usage terms.

To use a different MapLibre-compatible style:

```powershell
Copy-Item .env.example .env.local
```

Set `NEXT_PUBLIC_BASEMAP_STYLE_URL` in `.env.local` to a browser-accessible style URL. Do not place a secret credential in a `NEXT_PUBLIC_` variable.

## Optional cloud accounts

The cloud foundation uses Supabase Auth/Postgres for identity, ownership, metadata, and immutable revisions, plus a private Cloudflare R2 bucket for original images. Follow the [cloud setup guide](docs/CLOUD_SETUP.md). Local-only mode remains the default when these services are not configured.

Never commit `.env.local`, R2 credentials, Supabase secrets, report-fingerprint secrets, or Unlisted share tokens. The repository tracks only commented placeholders in `.env.example`.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate
```

`npm run validate` runs lint, TypeScript checking, and the Vitest suite. Run `npm run build` separately for production-build verification.

## Documentation

Start with the [documentation index](docs/README.md).

- [User guide](docs/USER_GUIDE.md)
- [Current architecture](docs/ARCHITECTURE.md)
- [Application API reference](docs/API_REFERENCE.md)
- [Operations and release runbook](docs/OPERATIONS.md)
- [Local data and privacy](docs/DATA_AND_PRIVACY.md)
- [Cloud setup](docs/CLOUD_SETUP.md)
- [Beta readiness](docs/BETA_READINESS.md)
- [Public information pages](docs/public-information-pages.md)
- [Product and technical design](PRODUCT_DESIGN.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Changelog](CHANGELOG.md)

Feature decision records are kept in `docs/` beside the current guides.

## Local-data warning

Saved maps and the active draft live in IndexedDB for the current browser profile and origin. Cloud checkpoints create a separate account copy only when a map is finished or the creator chooses **Save progress to cloud**; they never remove the local record. Use **Back up all maps** before clearing site data or moving devices even when cloud backup is configured.

Live GPS coordinates are processed in memory only. The viewer does not store a location trail or send coordinates to an application server.
