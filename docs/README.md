# Field Atlas documentation

This folder separates documentation of the **working local-first, account-gated creator beta and configured cloud/community foundation** from records describing why individual features were built. The larger public-beta vision lives in [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md).

## Start here

| Document | Audience | Purpose |
| --- | --- | --- |
| [`../README.md`](../README.md) | Everyone | Project summary, setup, routes, and current boundaries |
| [`USER_GUIDE.md`](USER_GUIDE.md) | Testers and contributors | Upload, anchor, save, view, locate, compare, and recover work |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Developers | Runtime components, routes, georeferencing pipeline, and dependencies |
| [`API_REFERENCE.md`](API_REFERENCE.md) | Developers | App Router API endpoints, authentication, inputs, outputs, and caching |
| [`DATA_AND_PRIVACY.md`](DATA_AND_PRIVACY.md) | Developers and testers | IndexedDB records, lifecycle, duplicate handling, GPS privacy, and loss risks |
| [`CLOUD_SETUP.md`](CLOUD_SETUP.md) | Operators and developers | Configure Supabase, R2, private sync, and second-device verification |
| [`OPERATIONS.md`](OPERATIONS.md) | Operators and maintainers | Backups, moderation, deployment, verification, incidents, and rollback |
| [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) | Maintainers | Completed slices, immediate work, and later phases |
| [`BETA_READINESS.md`](BETA_READINESS.md) | Maintainers, testers, and product collaborators | Release blockers, usability bugs, beta decisions, and verification checklist |
| [`../PRODUCT_DESIGN.md`](../PRODUCT_DESIGN.md) | Product and engineering | Validated long-term public-beta design |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Testers and maintainers | Implemented feature history |

## Feature decision records

- [`local-draft-persistence.md`](local-draft-persistence.md)
- [`local-saved-maps.md`](local-saved-maps.md)
- [`local-gps-viewer.md`](local-gps-viewer.md)
- [`local-map-compare.md`](local-map-compare.md)
- [`anchor-view-rotation.md`](anchor-view-rotation.md)
- [`portable-backup.md`](portable-backup.md)
- [`cloud-sync-foundation.md`](cloud-sync-foundation.md)
- [`community-publishing-foundation.md`](community-publishing-foundation.md)
- [`publication-deduplication.md`](publication-deduplication.md)
- [`my-maps-workflow-redesign.md`](my-maps-workflow-redesign.md)

These records capture accepted scope, alternatives, and decisions. If implementation behavior changes, update the corresponding record together with the current-state guides.

## Documentation conventions

- Say **current** or **implemented** only for behavior present in the repository.
- Say **planned**, **target**, or **future beta** for behavior not present in the repository.
- Prefer route names and exported data types over screenshots that can become stale.
- Distinguish automatic local draft saving from the implemented account-gated creator workflow and explicit cloud checkpoints in [`my-maps-workflow-redesign.md`](my-maps-workflow-redesign.md). Neither local autosave nor cloud checkpointing publishes a map automatically.
- Do not document GPS collection beyond foreground, in-memory browser use.
