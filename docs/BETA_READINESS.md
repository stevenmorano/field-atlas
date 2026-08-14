# Beta readiness

Status: beta backlog captured; the current production deployment is not yet the public beta release candidate
Last reviewed: 2026-08-13

This document is the working release checklist for people who did not build Field Atlas. It records the usability problems, workflow gaps, and product decisions that must be clear before inviting a broader group of testers.

The checklist is intentionally separate from the implementation history. A checked item means the behavior is implemented and verified in the deployed release candidate, not merely discussed or working in a local browser.

## Must fix before inviting beta testers

### 1. Keep map content visible

- Move or inset viewer zoom controls so they do not cover meaningful map content.
- Viewer zoom controls now sit in a compact toolbar above the map image instead of covering it.
- Replace the large GPS status card with a compact status bar or collapsible control. GPS details, accuracy, Recenter, and Stop must remain discoverable without blocking the map.
- Verify the layout at desktop, tablet, and phone widths.

### 2. Make Anchor Lab navigation reliable

- Add safe pan padding/overscroll so the top of the uploaded image can be moved below the **Your map** controls instead of being permanently hidden.
- Reproduce and fix the defect where dragging stops at very high zoom until the user zooms out.
- Maximum-zoom Anchor Lab panning now captures the gesture on the scroll viewport, with edge padding enabled while zoomed so image edges can be positioned below the pane controls.
- Deferred mobile QA: pinch-to-zoom works on the current basemap, but the uploaded-map pane currently requires its on-pane zoom buttons. Add touch pinch zoom to the uploaded-map pane and verify it at normal and maximum zoom.
- Verify pointer, touch, trackpad, wheel zoom, and 3,200% zoom behavior without changing anchor coordinates or existing browser maps.

### 3. Put Compare where public visitors can find it

- Add **Compare with today** directly to every effective Public or Unlisted map.
- Public and Unlisted viewers now show **Compare with today** directly in the header; Unlisted links carry their share token into Compare.
- Discover now shows a clear retry state when the community catalog is unreachable instead of substituting sample map cards that could be mistaken for live publications.
- Keep it available without an account and without requiring **Save on this device** first.
- Reuse the existing warped overlay behavior: Street, Satellite, Hybrid, opacity, visibility, and Fit overlay.
- Keep GPS viewing and comparison as separate, clearly labeled actions.

### 4. Make public revision updates understandable

- Detect when a local map has newer anchors, details, or imagery than the currently published revision.
- Explain the sequence in plain language: **Sync changes**, then **Update public map**.
- Preserve immutable publication history; updating must create a new publication snapshot rather than silently changing an existing public record.

### 5. Make sharing metadata fit real-world sources

- Keep **Source or reference** optional for physical maps, personal photographs, and items with no online source.
- Keep the rights declaration, license name when an open license is selected, and credit/attribution available.
- The optional-source change is implemented locally and must be included in the next release commit and deployment.

### 6. Make saving language unambiguous

- The anonymous viewer action now reads **Save on this device**; verify the deployed release and keep the wording consistent in guides and support copy.
- The Discover shelf now shows a loading state while the community catalog request is in flight, so configured deployments do not briefly show stale sample cards before real public maps arrive.
- On phone-sized viewers, an active GPS session collapses to the status and action buttons so the map remains the focus; explanatory GPS text remains available for loading and error states.
- Explain that browser-local saves can disappear when site data, private browsing data, or the browser profile is removed.
- Keep private cloud copies, local My Maps records, and community favorites visibly separate.
- Show the cloud-copy update time in addition to the date, using a readable local timestamp and a relative label such as **10 minutes ago** or **5 hours ago** so recent sync activity is easy to confirm.

## Beta feature decisions

### Orientation and rotation

- Store a non-destructive display rotation for a map instead of rewriting the uploaded image or anchor coordinates.
- Let the creator set a default display rotation before publishing.
- Let viewers rotate the GPS map and provide **Reset rotation**.
- Rotate the GPS marker, accuracy area, and Compare overlay consistently with the displayed image.
- Recommended first version: 90-degree rotation buttons plus Reset. Free-angle and automatic north-up behavior require a separate coordinate/orientation design review.

### Persistent community favorites

Account favorites should be a separate, durable feature from offline device saves:

- Signed-in users can choose **Save to favorites** on a public map.
- Favorites are stored against the account and appear on every signed-in device.
- Anonymous users retain **Save on this device** only.
- Clearing browser storage removes a local copy but does not remove an account favorite.

This is a high-priority beta product improvement if Field Atlas is offered as a cross-device community service. It should not be conflated with downloading a private cloud map into My Maps.

## Later, after the first beta

- About Field Atlas and beginner instruction pages.
- More advanced compass/north-up orientation tools.
- Optional current basemap presentation beneath the public GPS viewer outside Compare.
- Richer public revision history, notifications, and contributor workflows.

## Release verification

Before calling the beta release candidate ready:

1. Run `npm run validate`, `npm audit --omit=dev --audit-level=high`, and `npm run build`.
2. Exercise Anchor Lab and viewer flows at desktop and mobile dimensions, including touch and maximum zoom.
3. Exercise anonymous Public/Unlisted viewing, GPS, Compare, Save on this device, and reporting.
4. Exercise signed-in sync, changed-revision publication, profile display, and moderation access.
5. Confirm the Vercel deployment uses the intended Supabase/R2 environment values and callback origins.
6. Confirm existing IndexedDB maps, cloud revisions, publications, and R2 objects are preserved; no reset, destructive migration, or broad cleanup is part of this release.
