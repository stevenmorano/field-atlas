# Public information pages

Status: implemented locally; production release verification remains open
Last updated: 2026-08-14

## Understanding summary

Field Atlas will add three public, account-free information pages so a new visitor can understand the product before creating an account or using a map:

- **About Field Atlas** explains the purpose, privacy principles, and creator story.
- **How to use** provides a beginner walkthrough from public viewing and GPS through account creation, anchoring, saving, and publishing.
- **Changelog** presents polished, user-facing feature updates and meaningful fixes.

The pages are additive and do not read or mutate IndexedDB, Supabase, R2, GPS, publications, or private map data.

## Accepted structure

Routes:

- `/about`
- `/how-to-use`
- `/changelog`

Each route is a public, statically generated Next.js page with metadata, responsive editorial layout, keyboard-accessible links, a correct heading hierarchy, visible focus states, descriptive alt text, and no color-only instructions. The three pages are linked from desktop and mobile navigation plus the shared footer without changing the primary creator workflow.

### About Field Atlas

The page introduces the problem Field Atlas solves, explains the preservation/live-location/privacy principles, and includes an editable creator-bio placeholder. It links visitors to Discover and How to use.

### How to use

The guide uses six numbered sections:

1. Browse a public map.
2. Turn on GPS and understand the accuracy circle.
3. Use Compare to align the historic map with today’s basemap.
4. Create an account before uploading or editing.
5. Add anchor pairs in Anchor Lab.
6. Finish, save progress, and optionally publish.

Each section has a concise explanation, a “what to expect” callout, and a privacy-safe visual or screenshot with a caption.

### Changelog

Entries are grouped by release date and contain a short title plus two-to-four plain-language bullets. The page is intentionally separate from the technical repository `CHANGELOG.md`; the current 2026-08-14 creator/cloud workflow release is its first polished entry.

## Visual asset strategy

The first implementation may use neutral, privacy-safe walkthrough visuals. Real screenshots can replace them later without changing routes or content structure. Any real screenshot must be reviewed for private map names, account details, coordinates, credentials, and other sensitive data before being committed.

## Non-functional requirements

- Static content only; no API, account, GPS, or storage dependency.
- Fast initial render and cache-safe public navigation.
- Responsive layouts at phone, tablet, and desktop widths.
- Preserve the existing Field Atlas typography, colors, spacing, and button language.
- Keep copy understandable to a first-time visitor who did not build the product.

## Implementation and validation status

- [x] All three routes render as static pages while signed out.
- [x] Navigation links and route metadata are present.
- [x] Walkthrough visuals are privacy-safe HTML/CSS illustrations with descriptive captions; they do not include private map or account data.
- [x] `npm run validate` passes (lint, typecheck, 76 tests).
- [x] `npm run build` passes and prerenders `/about`, `/how-to-use`, and `/changelog`.
- [x] The pages contain no storage, cloud, publication, GPS, or account reads/writes.
- [ ] Verify final desktop/mobile presentation on the release candidate deployment.
- [ ] Replace the neutral walkthrough illustrations with reviewed app screenshots after removing private map names, account details, coordinates, and other sensitive data.
- [ ] Link the future Discover world-map and compact-list views from the public guide once those catalog modes exist.

## Assumptions

- The creator-bio placeholder will remain editable source copy until the owner supplies final wording.
- The public changelog will favor reader value over internal implementation detail.
- Screenshots are optional presentation assets, not required runtime data.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-14 | Use three focused routes instead of one long Learn page. | Easier to scan, link, and maintain on mobile. |
| 2026-08-14 | Start with regular React page content instead of an MDX pipeline. | Lower complexity while content volume and editing needs are still small. |
| 2026-08-14 | Keep the public changelog user-facing and separate from technical `CHANGELOG.md`. | New visitors need outcomes and benefits, while maintainers need implementation history. |
| 2026-08-14 | Use privacy-safe visuals first and replace them with reviewed screenshots later. | Avoid exposing private map or account data while preserving the visual teaching structure. |
