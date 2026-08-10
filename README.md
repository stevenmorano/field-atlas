# Field Atlas

Field Atlas is a web-first application for putting live browser GPS on almost any raster map: historic atlases, trail signs, illustrated zoo maps, amusement-park maps, aerial photographs, and maps whose scale or orientation differs from modern geography.

The current build is a local-first functional prototype. A map image, its metadata, and its anchor pairs stay together in the browser. No account or backend is required for the working creation, viewing, GPS, and comparison flows.

## Current capabilities

- Upload JPEG, PNG, WebP, HEIC, or HEIF files supported by the browser decoder.
- Pan, deep-zoom (up to 3200%), and rotate the uploaded map in 90-degree steps while anchoring.
- Match numbered image landmarks to Street, Satellite, or Hybrid MapLibre basemaps.
- Improve predictions progressively with similarity, affine, and triangulated piecewise-affine transforms.
- Undo, redo, delete, clear, and resume anchor work with debounced IndexedDB autosave.
- Finish a map with structured title, place, date, subject, style, activity, source, and visibility metadata.
- Keep multiple high-resolution maps in the browser-local My Maps library.
- Reopen a saved map for additional anchors without creating an accidental duplicate.
- View a saved image at full resolution and project foreground browser GPS onto it with an accuracy area.
- Compare a saved map as a warped, adjustable-opacity overlay on a live basemap.
- Install the production build as a PWA with a small offline application shell.

The Discover catalog currently uses four sample records. Public uploads, accounts, cloud synchronization, community moderation, PDF conversion, and production offline packages are planned but are not implemented.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Useful routes:

| Route | Purpose |
| --- | --- |
| `/` | Sample Discover experience and foreground location sorting |
| `/anchor` | Resume the current Anchor Lab draft |
| `/anchor/new` | Safely start a fresh map after checking for an active draft |
| `/my-maps` | Search and open locally saved maps |
| `/maps/[mapId]` | High-resolution saved-map and GPS viewer |
| `/maps/[mapId]/compare` | Warped overlay comparison |

## Basemaps

Without configuration, the prototype uses attributed OpenStreetMap raster tiles for Street, Esri World Imagery for Satellite, and a translucent OSM-over-imagery Hybrid mode. These modes require internet access unless the browser already cached the needed resources and remain subject to each provider's usage terms.

To use a different MapLibre-compatible style:

```powershell
Copy-Item .env.example .env.local
```

Set `NEXT_PUBLIC_BASEMAP_STYLE_URL` in `.env.local` to a browser-accessible style URL. Do not place a secret credential in a `NEXT_PUBLIC_` variable.

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
- [Local data and privacy](docs/DATA_AND_PRIVACY.md)
- [Product and technical design](PRODUCT_DESIGN.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Changelog](CHANGELOG.md)

Feature decision records are kept in `docs/` beside the current guides.

## Local-data warning

Saved maps and the active draft live in IndexedDB for the current browser profile and origin. They are not yet synchronized elsewhere. Clearing site data, changing browsers, or using another device will not carry them over. Portable backup and restore is the next planned local-safety increment; until it ships, preserve the browser profile containing important maps.

Live GPS coordinates are processed in memory only. The viewer does not store a location trail or send coordinates to an application server.
