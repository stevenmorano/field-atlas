# My Maps workflow redesign

Status: accepted product design; first implementation slice implemented locally, with release verification and database hardening remaining
Last updated: 2026-08-14

This decision record defines the simpler creator and cloud workflow for the next beta increment. It replaces the current user-facing distinction between local maps, account copies, and manual sync controls without deleting or rewriting existing data.

## Problem

The former My Maps page exposed storage implementation details: maps on this device, maps in the account, and maps available to download. A creator could also begin anchoring before learning that an account was required, and cloud sync felt like a technical maintenance task rather than a clear save action. The account gate, unified library, client cooldown, and cloud API guard are now implemented locally; final release verification and database-level concurrency hardening remain.

## Accepted product direction

Field Atlas has two understandable modes:

- **Viewer mode:** no account is required to browse Public maps, open Unlisted links, use GPS, pan and zoom, rotate the displayed map, or use Compare.
- **Creator mode:** an account is required before Start a map, image upload, Anchor Lab, anchor editing, map creation, cloud backup, or publishing.

The account gate appears before the image picker or any creator work begins. Existing browser maps remain preserved; if a signed-out user can see a legacy local map, it is viewable but creator actions require signing in.

## Save and backup behavior

Automatic protection and cloud backup are intentionally different:

1. Local draft state saves automatically after edits. This protects the current browser without producing network traffic for every anchor.
2. The creator chooses **Save progress to cloud** when they are done for now. The button is enabled only when there are unsaved cloud changes.
3. **Finish map** always performs a final private cloud backup before moving the record from Drafts into completed My Maps.
4. After a successful cloud save, any signed-in device can load that checkpoint automatically. Unsaved local changes remain only on the originating device until the creator saves them to cloud.
5. The UI separates **Saved locally** from **Last backed up to cloud** and provides a small **Refresh maps** fallback when a cached page is stale.

Cloud saves have two safeguards:

- a client and server minimum interval of 30 seconds between saves for the same map;
- content-fingerprint idempotency, so submitting unchanged content performs no new upload or revision.

The server must enforce both safeguards. A client-only disabled button is not sufficient protection against repeated requests.

## Unified My Maps library

My Maps becomes one library rather than separate local and cloud sections:

- **Drafts** appear first and contain unfinished creator work. Each draft offers **Continue editing**.
- **My Maps** contains every completed map the user created, regardless of Private, Unlisted, or Public visibility.
- Cloud-only maps still appear in the same completed list. They offer **Open map** and **Compare** immediately; **Save for offline** is optional when the original is not on this device.
- Downloaded maps show **Available offline** and offer **Remove from this device**. Removal deletes only the local offline copy; the account map, publication, and library card remain.
- A map with unsaved local work cannot have its offline copy removed until the work is safely backed up.
- A local map that is older than its cloud checkpoint offers **Download latest** before offline removal is available.
- If the cloud checkpoint contains more anchors than the device copy, My Maps calls out the cloud anchor count and offers **Download latest** even when device timestamps are newer; this avoids mistaking a newer local timestamp for newer map content.
- Technical counters such as “on this device,” “in your account,” and “available to download” are removed.
- A later increment may add Favorites, sorting, filters, list view, and compact view without changing this ownership model.

## Storage and revision rules

- Original images remain private R2 assets and are deduplicated by content hash when unchanged.
- Cloud checkpoints update only when the creator chooses **Save progress to cloud** or finishes a map; they do not create a permanent immutable revision for every anchor.
- Meaningful finished and published states retain immutable revisions for recovery, publication isolation, and moderation history.
- GPS remains foreground, in-memory browser state and is never included in a cloud backup.
- Automatic local saves remain available during a temporary cloud outage; the interface reports that the latest cloud checkpoint still needs saving.

## Existing-data migration

The redesign must be additive and non-destructive:

- Existing IndexedDB maps, active drafts, cloud maps, immutable revisions, publications, and R2 objects remain intact.
- The unified library merges local and cloud records by their stable map ID and accepted content fingerprints rather than creating duplicate cards.
- A cloud-only record receives a library card immediately; opening and comparing it stream the authorized account copy, while downloading it for offline use remains optional.
- No browser reset, broad cleanup, destructive SQL, R2 deletion, or publication overwrite is part of this increment.

## Explicit non-goals for this increment

- Account-backed Favorites and community saved-map collections.
- Advanced sorting, filtering, list/compact layouts, or richer library views.
- Automatic public publishing or a default change from Private to Public.
- Uploading every anchor event or continuously creating immutable cloud revisions.

## Validation requirements

Before release, tests and browser checks must cover:

- creator account gating before image selection and Anchor Lab entry;
- local draft recovery after reload or a browser crash simulation;
- explicit cloud-save dirty state, 30-second rate limiting, and duplicate-fingerprint no-op behavior;
- Finish map moving a draft into completed My Maps after successful backup;
- unified rendering of local, cloud-only, and downloaded maps without duplicate cards;
- download/remove-offline behavior without deleting the cloud record or publication;
- Refresh maps recovering a stale library without hiding cached records;
- preservation of existing IndexedDB data, cloud records, revisions, publications, and R2 objects.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-08-14 | Require an account before all creator workflows, while leaving anonymous viewing, GPS, and Compare open. |
| 2026-08-14 | Put Drafts above one unified completed My Maps library. |
| 2026-08-14 | Save locally automatically; send cloud checkpoints only through Save progress to cloud or Finish map. |
| 2026-08-14 | Enforce a 30-second per-map cloud-save interval and server-side content-fingerprint idempotency. |
| 2026-08-14 | Show online availability first; make offline availability an optional Save for offline / Remove from this device toggle. |
