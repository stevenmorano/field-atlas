# Beta readiness

Status: beta backlog captured; the current production deployment is not yet the public beta release candidate
Last reviewed: 2026-08-15

This document is the working release checklist for people who did not build Field Atlas. It records the usability problems, workflow gaps, and product decisions that must be clear before inviting a broader group of testers.

The checklist is intentionally separate from the implementation history. A checked item means the behavior is implemented and validated in the current codebase. Live Vercel verification remains a separate release gate below, so local completion is never presented as deployed completion.

Status key: `[x]` implemented and locally validated · `[ ]` still needs implementation or verification.

## Must fix before inviting beta testers

### 1. Keep map content visible

- [x] Viewer zoom controls now sit in a compact toolbar above the map image instead of covering it.
- [x] The GPS status card is compact while keeping GPS details, accuracy, Recenter, and Stop discoverable.
- [ ] Verify the layout at desktop, tablet, and phone widths on the release candidate.

### 2. Make Anchor Lab navigation reliable

- [x] Anchor Lab has safe pan padding/overscroll so the top of the uploaded image can be moved below the **Your map** controls.
- [x] The high-zoom dragging defect is fixed; panning captures the gesture on the scroll viewport and keeps edge padding enabled.
- [x] The uploaded-map pane can zoom out to 50% so large sheets can be viewed as a whole while anchoring.
- [x] Reduced-zoom uploaded maps are centered below the floating controls, and native image dragging is disabled while pointer capture handles panning. Lost pointer capture also clears the active drag state.
- [x] Hovering either Anchor Lab pane previews the corresponding point in the other pane with a red guide marker.
- [x] Folded-mesh warnings identify the exact anchor numbers, distinguish folded-triangle count from unique involved-anchor count, and outline each affected triangle in both panes; the matching markers and correction-history rows are highlighted.
- [ ] Add touch pinch-to-zoom to the uploaded-map pane and verify it at normal and maximum zoom.
- [ ] Verify pointer, touch, trackpad, wheel zoom, and 3,200% zoom behavior without changing anchor coordinates or existing browser maps.

### 3. Put Compare where public visitors can find it

- [x] Public and Unlisted viewers show **Compare with today** directly in the header; Unlisted links carry their share token into Compare.
- [x] Discover shows a clear retry state when the community catalog is unreachable instead of substituting sample map cards.
- [x] Discover exposes **Refresh maps** and requests the catalog without a cache so a newly completed Public publication can be found immediately.
- [x] Compare works without an account and without requiring **Save on this device** first.
- [x] Compare reuses the warped overlay behavior: Street, Satellite, Hybrid, opacity, visibility, and Fit overlay.
- [x] GPS viewing and comparison remain separate, clearly labeled actions.
- [x] Public map detail continues to the authorized public copy when no private cloud session or private cloud map is available.

### 4. Make public revision updates understandable

- [x] Detect when the latest synced cloud revision is newer than the currently published revision.
- [x] Explain the sequence in plain language: **Save progress to cloud**, then **Update public map**.
- [x] Preserve immutable publication history; updating creates a new publication snapshot rather than silently changing the existing public record.

### 5. Make sharing metadata fit real-world sources

- [x] **Source or reference** is optional for physical maps, personal photographs, and items with no online source.
- [x] The rights declaration, license name when an open license is selected, and credit/attribution remain available.
- [ ] Verify the optional-source flow on the release candidate.

### 6. Make saving language unambiguous

- [x] The anonymous viewer action reads **Save on this device**, with consistent wording in guides and support copy.
- [x] The Discover shelf shows a loading state while the community catalog request is in flight.
- [x] On phone-sized viewers, an active GPS session collapses to status and action buttons so the map remains the focus.
- [x] The guides explain that browser-local saves can disappear when site data, private browsing data, or the browser profile is removed.
- [ ] Keep private cloud copies, local My Maps records, and community favorites visibly separate; durable account favorites remain a later feature.
- [x] Cloud-copy rows show a readable local date/time plus a relative label such as **10 minutes ago** or **5 hours ago**.

## Beta feature decisions

### Creator accounts and unified My Maps

The accepted redesign is documented in [`my-maps-workflow-redesign.md`](my-maps-workflow-redesign.md). The first local implementation slice is now in place; remaining database-level hardening and release verification stay open:

- [x] Require account creation/sign-in before image upload, Anchor Lab, editing, map creation, cloud backup, or publishing.
- [x] Keep anonymous Public/Unlisted viewing, GPS, and Compare available.
- [x] Save drafts automatically on the device, while cloud backup happens through **Save progress to cloud** or **Finish map**.
- [x] Enforce a 30-second per-map cloud-save interval in the client and cloud API route; duplicate-fingerprint protection is implemented. Database-level concurrency hardening remains an operational follow-up.
- [x] Put Drafts above one completed My Maps library containing local and cloud-only records.
- [x] Keep cloud-only cards usable online with **Open map** and **Compare**; make **Save for offline**, **Download latest**, and **Remove from this device** optional device actions that never delete the account map or publication.
- [x] Detect a cloud checkpoint with more anchors than the device copy even when timestamps disagree, and require an explicit **Download latest** action before replacing the local record.
- [x] Add a small **Refresh maps** fallback while preserving cached records when a refresh fails.
- [x] Reflect the cloud publication state on each local My Maps card and refresh it after Share or Make private completes.
- [x] Reconcile an idempotent **already backed up** response with the local My Maps card so timestamp-only local saves do not remain stuck as unsynced work; a later real edit still requires a new checkpoint.
- [x] Share explains a stale private cloud checkpoint and offers **Save progress to cloud** inline before publication.
- [x] Make the Finish map dialog distinguish local “Ready to share later” preparation from actual Public/Unlisted publication.

### Orientation and rotation

- [ ] Store a non-destructive display rotation for a map instead of rewriting the uploaded image or anchor coordinates.
- [ ] Let the creator set a default display rotation before publishing.
- [ ] Let viewers rotate the GPS map and provide **Reset rotation**.
- [ ] Rotate the GPS marker, accuracy area, and Compare overlay consistently with the displayed image.
- [ ] Recommended first version: 90-degree rotation buttons plus Reset. Free-angle and automatic north-up behavior require a separate coordinate/orientation design review.

### Persistent community favorites

Account favorites should be a separate, durable feature from offline device saves:

- [ ] Signed-in users can choose **Save to favorites** on a public map.
- [ ] Favorites are stored against the account and appear on every signed-in device.
- [x] Anonymous users retain **Save on this device** only.
- [ ] Clearing browser storage removes a local copy but does not remove an account favorite.

This is a high-priority beta product improvement if Field Atlas is offered as a cross-device community service. It should not be conflated with downloading a private cloud map into My Maps.

## Later, after the first beta

- [x] About Field Atlas and beginner instruction pages are available at `/about` and `/how-to-use`; the user-facing release history is at `/changelog`.
- [ ] More advanced compass/north-up orientation tools.
- [ ] Optional current basemap presentation beneath the public GPS viewer outside Compare.
- [ ] Add a public world-map directory view alongside a compact, searchable list of all available maps.
- [ ] Richer public revision history, notifications, and contributor workflows.

## Release verification

Before calling the beta release candidate ready:

1. [x] Run `npm run validate`, `npm audit --omit=dev --audit-level=high`, and `npm run build`.
2. [ ] Exercise Anchor Lab and viewer flows at desktop and mobile dimensions, including touch and maximum zoom.
3. [ ] Exercise anonymous Public/Unlisted viewing, GPS, Compare, Save on this device, and reporting.
4. [ ] Exercise signed-in sync, changed-revision publication, profile display, and moderation access.
5. [ ] Confirm the Vercel deployment uses the intended Supabase/R2 environment values and callback origins.
6. [ ] Confirm existing IndexedDB maps, cloud revisions, publications, and R2 objects are preserved; no reset, destructive migration, or broad cleanup is part of this release.
