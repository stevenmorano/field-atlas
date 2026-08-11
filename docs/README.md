# Field Atlas documentation

This folder separates documentation of the **working local prototype** from records describing why individual features were built. The larger public-beta vision lives in [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md).

## Start here

| Document | Audience | Purpose |
| --- | --- | --- |
| [`../README.md`](../README.md) | Everyone | Project summary, setup, routes, and current boundaries |
| [`USER_GUIDE.md`](USER_GUIDE.md) | Testers and contributors | Upload, anchor, save, view, locate, compare, and recover work |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Developers | Runtime components, routes, georeferencing pipeline, and dependencies |
| [`DATA_AND_PRIVACY.md`](DATA_AND_PRIVACY.md) | Developers and testers | IndexedDB records, lifecycle, duplicate handling, GPS privacy, and loss risks |
| [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) | Maintainers | Completed slices, immediate work, and later phases |
| [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md) | Product and engineering | Validated long-term public-beta design |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Testers and maintainers | Implemented feature history |

## Feature decision records

- [`local-draft-persistence.md`](local-draft-persistence.md)
- [`local-saved-maps.md`](local-saved-maps.md)
- [`local-gps-viewer.md`](local-gps-viewer.md)
- [`local-map-compare.md`](local-map-compare.md)
- [`anchor-view-rotation.md`](anchor-view-rotation.md)
- [`portable-backup.md`](portable-backup.md)

These records capture accepted scope, alternatives, and decisions. If implementation behavior changes, update the corresponding record together with the current-state guides.

## Documentation conventions

- Say **current** or **implemented** only for behavior present in the repository.
- Say **planned**, **target**, or **future beta** for unimplemented backend/community behavior.
- Prefer route names and exported data types over screenshots that can become stale.
- Distinguish the implemented user-managed `.fieldatlas` export/import from automatic cloud backup or cross-device synchronization, which do not yet exist.
- Do not document GPS collection beyond foreground, in-memory browser use.
