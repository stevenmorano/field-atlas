# Local saved maps

Status: implemented  
Last reviewed: 2026-08-14

## Understanding summary

- A working draft can become a durable, named map without losing its original image or anchors.
- Creator access requires an account, while the saved records remain local-first in the current browser.
- Structured metadata supports implemented public catalog fields and future richer filters.
- New maps default to private; public-ready records intent only and never publishes without the separate cloud Share action.
- My Maps lists multiple locally saved maps rather than only the active draft.
- A saved map can be viewed, compared, or reopened for later anchor improvements.

## Assumptions and requirements

- Beta scale is dozens of maps on one device, not thousands of browser-local records.
- Full-resolution image Blobs are retained; anchors and metadata are comparatively small.
- IndexedDB is available. Clearing browser data can remove all local maps.
- No live GPS coordinates, viewing history, or traveled paths are stored.
- Writes are versioned and transactional, and database upgrades preserve the active draft.
- There is no general destructive delete control; **Remove from this device** only removes an offline copy that also exists in the account.

## Approaches considered

1. **Versioned IndexedDB map library (selected):** preserves Blobs offline, supports multiple named records, and leaves a path to later sync.
2. **localStorage:** rejected because image Blobs do not fit safely and serialization is synchronous.
3. **Immediate backend:** originally deferred until local viewing was proven; the optional Supabase/R2 path was added later without replacing IndexedDB.

## Current design

**Finish map** opens an accessible metadata dialog once at least two anchors exist. Title is required. Place, description, subject, visual style, map-date kind/year, activities, source, and visibility are structured fields. Saving creates or updates a stable UUID record containing the image Blob, dimensions, anchors, editor state, metadata, and timestamps.

The active draft stores the UUID. Later anchor autosaves update the linked map's content without replacing metadata. My Maps puts an unfinished Draft above one completed library, merges local and cloud-only records by stable ID, sorts by update time, previews local sources, exposes relevant facts, and searches title, place, type, style, description, date, and activities. Local cards support **Open map**, **Compare**, and **Edit anchors**; cloud-only cards support online **Open map** and **Compare**, with optional **Save for offline**.

When records share the same normalized filename, dimensions, Blob byte size, and MIME type, listing My Maps consolidates them non-destructively. The record with the most anchors (then newest update) becomes canonical, unique anchor IDs are merged, and sibling records receive `supersededBy` rather than being deleted.

My Maps also exposes one portable backup containing every active/canonical record and the current draft. Imported same-ID conflicts are explicitly marked as intentional variants so consolidation keeps both copies visible.

## Decision log

- **L-001 - Local named maps first:** selected IndexedDB as the durable browser copy while requiring an account before creator work.
- **L-002 - Preserve the current draft:** database version 2 adds `saved-maps` beside `anchor-drafts`.
- **L-003 - Private default:** public-ready is intent only; explicit sync and Share are separate operations.
- **L-004 - Structured metadata now:** catalog facets are stored separately from the title.
- **L-005 - Autosync linked maps:** later anchor edits update their stable record.
- **L-006 - No deletion:** user work is retained while recovery/export is unfinished.
- **L-007 - Theme-independent storage:** UI styling can change without a data migration.
- **L-008 - Exact-source saves resolve to one map:** the strongest record becomes canonical and older siblings are retained.
- **L-009 - Saved maps are directly useful:** records link to GPS viewing and Compare, not only editing.
- **L-010 - Portable safety copy:** active maps and the current draft can round-trip without recompressing source images or overwriting existing records.
