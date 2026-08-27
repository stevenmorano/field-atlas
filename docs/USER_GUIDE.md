# User guide

Status: account-gated creator beta with local drafts, private checkpoints, and community publishing
Last reviewed: 2026-08-15

## Important storage warning

Your working library is stored in this browser profile on this website origin. Before clearing site data or switching browsers/devices, open My Maps and choose **Back up all maps**. Sign in before creating a map; local drafts save automatically, while cloud checkpoints happen when you finish a map or choose **Save progress to cloud**. Retain a private `.fieldatlas` backup too.

## Create and anchor a map

1. Open `/account` and create or sign in to an account, then open `/anchor/new` or choose **Start a map**.
2. If an active draft exists, choose whether to continue it or start fresh. A finished copy already in My Maps remains safe when its active draft is replaced.
3. Choose **Choose map image** and select a JPEG, PNG, WebP, HEIC, or HEIF image that your browser can decode.
4. On **Your map**, drag to pan and use the mouse wheel, trackpad, pinch gesture, or zoom buttons. You can zoom out to 50% to see more of a large sheet at once; zoom is capped at 3200% to protect browser rendering.
5. If the image is sideways, use the rotate-left or rotate-right buttons. Rotation changes only the working view, not the original pixels or anchor coordinates.
6. Click or tap a recognizable landmark on the uploaded image. A pending marker appears on the basemap.
7. Pan and zoom the basemap until its marker is on the same real-world landmark. Choose Street, Satellite, or Hybrid when the built-in style is active.
8. Move over either pane to preview the corresponding point in the other pane. The red hover marker is only a guide; click or tap to begin an anchor pair.
9. Select **Save pair**. Repeat with landmarks spread across the map.

After two anchors, Field Atlas predicts the next basemap position using scale, rotation, and translation. Additional well-distributed anchors add skew and local correction. You may still move every predicted basemap marker before saving it.

## Correct anchor work

- **Undo** and **Redo** step through anchor changes.
- Click a numbered image marker, its corresponding delete button in Correction history, or the `x` beside the pair to remove it.
- **Clear** removes the current anchor set and can be undone until history is replaced.
- Add anchors near areas where GPS or Compare alignment seems inaccurate.
- Prefer distinct landmarks spread around the usable area. Clusters improve only a small region.
- Treat mesh warnings seriously; contradictory or folded triangles can make GPS misleading. Each folded triangle relates three anchors, but triangles can share anchors, so the warning separately reports the triangle count and the number of unique involved anchors. Anchor Lab outlines the triangles in orange in both panes, highlights the involved markers and history rows, and names the anchor numbers. Correct those specific pairs instead of clearing the whole set.

## Drafts and finished maps

Creating a map requires a signed-in account. Anonymous visitors can still browse Public maps,
open Unlisted links, use GPS, and compare maps without signing in. The account check appears before
an image upload or an Anchor Lab session begins, so there is no surprise sign-in requirement after
work has started.

The active Anchor Lab draft saves automatically shortly after meaningful changes. **Save draft** writes immediately. Wait for the visible Saved status before deliberately closing a fragile browser session.

A draft and a finished map are related but different:

- The draft is the one active editing workspace.
- **Finish map** requires at least two anchors and creates a named My Maps record.
- Once a draft is linked to a finished map, later anchor autosaves also update that saved map's content.
- **Map details** edits its structured metadata.
- Starting fresh replaces the active draft, not the finished record in My Maps.

Metadata includes title, description, place, subject, visual style, map date, activities, source, and a private/ready-to-share intent. **Ready to share later** is only a local label; saving the map or syncing it to your account never publishes it. Public or Unlisted access always requires the separate **Share** action.

## Use My Maps

Open `/my-maps` to see all active saved records. Search by title, place, type, year, activity, or description.

- **Open map** opens the high-resolution raster viewer.
- **Compare** overlays the map on current geography.
- **Edit anchors** makes that saved map the active Anchor Lab draft and opens the editor.
- **Start another map** enters the safe new-map check before replacing the current draft.

If the same source image was accidentally saved more than once, Field Atlas consolidates exact-source records and preserves the strongest anchor set. Superseded records remain in storage and are not deleted.

## Save work across devices

Cloud controls appear when the operator has completed [`CLOUD_SETUP.md`](CLOUD_SETUP.md).

1. Open `/account` and create or sign in to an email/password account before starting a map.
2. Drafts save automatically on the current device while you work.
3. Choose **Finish map** to create the completed My Maps record and back up that checkpoint to your account.
4. For a completed map, choose **Save progress to cloud** in My Maps whenever you want to checkpoint additional changes. The app prevents repeated saves within a short cooldown and skips identical content.
5. Sign in on another device and open **My Maps**. Cloud-only records appear in the same library and can be opened or compared online immediately. If a cloud copy has more anchors than the device copy, My Maps shows that count and offers **Download latest**. Choose it only when you want that cloud revision to replace the local copy. Choose **Save for offline** for a cloud-only map when you also want a local copy; the image is checksum-verified before it is added to that device.
6. A downloaded map can be removed from the device with **Remove from this device**. This never deletes the account copy or a publication. If local edits are newer, save progress first.

Use **Refresh maps** if a cached page is stale. Each cloud-backed row shows the exact update date and time plus a relative label such as **10 minutes ago**, so you can confirm how recently a copy was synced.

If My Maps says **Already up to date in the cloud**, no new revision was needed: the local record and current cloud revision contain the same map content. The card is treated as backed up after that acknowledgement, even if a local save gave the record a newer timestamp. A real anchor, image, or metadata change will make **Save progress to cloud** available again.

Repeated syncs create immutable revisions. If another device changed the same map after this browser's last accepted revision, Field Atlas preserves the new upload as a conflict instead of silently replacing the remote current version. Conflict review UI is planned; keep both local copies and the `.fieldatlas` backup in the meantime.

## Share a map publicly or by link

Community sharing appears after the operator applies all migrations in [`CLOUD_SETUP.md`](CLOUD_SETUP.md).

1. Finish the map or choose **Save progress to cloud** in My Maps so the latest checkpoint is backed up. If Share detects that the device copy is newer, choose **Save progress to cloud** directly in the warning inside the Share dialog; publishing unlocks after the checkpoint is confirmed.
2. In My Maps, choose **Share** beside that map.
3. Choose **Public** to list it in Discover immediately, or **Unlisted** to create an immediate secret link that is absent from Discover.
4. Select why you are allowed to share it and add a source, license, or attribution when available. A web source is optional; for a physical map or personal photograph, use the attribution field to explain what you know.
5. Confirm that other people can open the separate shared copy immediately. The unchanged original remains private.
6. Use the returned link or open the public map. **Make private** stops future access without removing local/private-cloud work; it cannot recall a copy someone already downloaded.

For a very large scan, Field Atlas keeps the original private and automatically prepares a smaller high-quality shared copy, up to 6,000 pixels on the long edge. No re-upload or manual reduction is needed, and the anchors are adjusted for the shared copy so GPS and Compare stay aligned. If the source exceeds the bounded processing limit, the Share dialog explains that a smaller source is required; your private map is preserved.

Public visitors do not need an account to open the map, use foreground GPS, save it on this device for offline use, visit the uploader profile, or report a problem. A device save is browser-local; it is not an account favorite. Public maps enter the administrator's post-publication queue but do not wait there before becoming usable.

After publishing, the My Maps card refreshes to **Public** (or **Pending review**) when the account copy is checked. If a card still says **Ready to share**, open **Share** to see the authoritative owner status; a publication that did not finish will still offer **Publish publicly now**. If a completed Public map is not visible in Discover, use **Refresh maps** there; the catalog is intentionally fetched fresh.

Opening Share again for the exact same synced revision and the same sharing fields shows **Already published**. If the latest cloud revision is newer than the public snapshot, Share explains that the public map is older and changes the action to **Update public map** (or **Update shared map** for an Unlisted map). Select it after confirming the new snapshot. The previous publication remains in immutable history while the new one becomes current. Switching visibility, rights/source/credit fields, or syncing changed anchors, details, or imagery creates a legitimate new publication.

## Maintain a public profile

The first sign-in creates a generated username so email is never exposed publicly. Open `/account` to change the username and short bio. The public page at `/profiles/[username]` shows only public contribution information, a generated avatar, and implemented milestones. It never shows email, private maps, live location, viewing history, or a home location.

## Report or moderate a public map

Anyone can select **Report a problem** on an effective Public or Unlisted map without creating an account. Choose a category and optionally explain the problem; do not include private or precise personal location information in the note.

Administrators open `/moderation`. **Mark checked** records a routine beta check, **Request changes** leaves the map visible with a reason, **Hide map** removes anonymous access and places a map-wide publishing hold, and **Restore map** clears that hold and returns it to review. **Admin checked** is not a guarantee of positional accuracy, map quality, safety, ownership, or legal status.

## Back up or restore My Maps

Open `/my-maps` and find **Protect your maps**.

1. Choose **Back up all maps** to download one dated `.fieldatlas` file.
2. The file contains every active saved map, its exact original image bytes, metadata and anchors, plus the active unfinished Anchor Lab draft when one exists.
3. Keep the file somewhere you trust. Private map images remain private only if the backup file does.
4. To restore, choose **Import backup** and select the `.fieldatlas` file.
5. Review the verified preview before importing. It lists new maps, already-present maps, same-ID conflicts kept as separate copies, and draft behavior.

Import never silently overwrites a saved map. Exact duplicates are skipped. A divergent map with an existing ID is kept as a visible **(Imported copy)**. If the browser already has an active draft, the current draft remains selected unless you explicitly choose to replace it.

## View a map and use GPS

1. Select **Open map** from My Maps.
2. Pan, pinch, wheel, or use the zoom buttons to inspect the original-resolution image.
3. Select **Find me** to request browser location permission.
4. The viewer projects the live reading through the saved anchors and shows a blue dot plus an accuracy area.
5. Manual panning stops following the dot. Select **Recenter** to follow it again.

GPS works only on secure origins in normal browsers; `localhost` is treated as secure for development. Some embedded or in-app browsers may deny or omit location. A saved map remains viewable without permission. Location watching stops when the page is hidden or left, and the app does not store a trail.

Public and Unlisted links use the shared sanitized copy and do not require a private cloud session. A private cloud copy, when available to the signed-in owner, is checked first so the owner can open the latest account revision.

Locations outside the triangulated anchor area are labeled as extrapolated and are less reliable. A point outside the image is not forced onto the map.

## Compare with a current map

Select **Compare** from My Maps or **Compare with today** on a Public or Unlisted map viewer. Compare mode automatically rotates, scales, skews, and locally warps the source using its existing anchors. Public comparison works without an account or device save first, and signed-in cloud-only maps can be compared before saving an offline copy.

- Use **Opacity** to see both eras/layers.
- Toggle the overlay without losing the current view.
- Change Street, Satellite, or Hybrid mode.
- Use **Fit overlay** to return to the warped image extent.

Compare is for visual exploration, not survey work. Areas outside distributed anchors use extrapolation and may drift. The original image is not changed.

## Troubleshooting

### A saved map is missing

Confirm that you are using the same browser profile, hostname, and port that created it. `localhost:3000` and another deployed domain have separate IndexedDB storage. If you have a `.fieldatlas` backup, import it from My Maps. Avoid clearing browser data until the backup has been verified.

### The base map is blank

The default basemaps require network access and third-party tile availability. Check the connection and browser console. The uploaded image and saved records are independent of a basemap outage.

### Location does not work

Use a secure page, allow location permission for the site, and try a normal mobile browser if an embedded browser blocks geolocation. Location quality comes from the device; a large accuracy area does not necessarily mean the anchors are wrong.

### HEIC or HEIF does not display

The file picker accepts these formats, but successful display depends on native browser decoding. Convert to JPEG, PNG, or WebP when the browser cannot decode the file.

### Starting a new map shows the previous one

Use `/anchor/new` and confirm **Start fresh map**. `/anchor` intentionally resumes the active draft.

### Share says Already published

That exact cloud revision and sharing setup are already live. Close the dialog if no update is needed. To publish an update, first edit and save the map to cloud, then open Share and choose **Update public map** when it appears. Use **Make private** only when you intend to stop anonymous access.
