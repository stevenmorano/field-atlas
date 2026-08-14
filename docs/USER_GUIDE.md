# User guide

Status: working local-first prototype with optional private sync and community publishing
Last reviewed: 2026-08-12

## Important storage warning

Your working library is stored in this browser profile on this website origin. Before clearing site data or switching browsers/devices, open My Maps and choose **Back up all maps**. Optional account sync is explicit rather than automatic, so retain a private `.fieldatlas` backup too.

## Create and anchor a map

1. Open `/anchor/new` or choose **Start a map**.
2. If an active draft exists, choose whether to continue it or start fresh. A finished copy already in My Maps remains safe when its active draft is replaced.
3. Choose **Choose map image** and select a JPEG, PNG, WebP, HEIC, or HEIF image that your browser can decode.
4. On **Your map**, drag to pan and use the mouse wheel, trackpad, pinch gesture, or zoom buttons. Zoom is capped at 3200% to protect browser rendering.
5. If the image is sideways, use the rotate-left or rotate-right buttons. Rotation changes only the working view, not the original pixels or anchor coordinates.
6. Click or tap a recognizable landmark on the uploaded image. A pending marker appears on the basemap.
7. Pan and zoom the basemap until its marker is on the same real-world landmark. Choose Street, Satellite, or Hybrid when the built-in style is active.
8. Select **Save pair**. Repeat with landmarks spread across the map.

After two anchors, Field Atlas predicts the next basemap position using scale, rotation, and translation. Additional well-distributed anchors add skew and local correction. You may still move every predicted basemap marker before saving it.

## Correct anchor work

- **Undo** and **Redo** step through anchor changes.
- Click a numbered image marker, its corresponding delete button in Correction history, or the `x` beside the pair to remove it.
- **Clear** removes the current anchor set and can be undone until history is replaced.
- Add anchors near areas where GPS or Compare alignment seems inaccurate.
- Prefer distinct landmarks spread around the usable area. Clusters improve only a small region.
- Treat mesh warnings seriously; contradictory or folded triangles can make GPS misleading.

## Drafts and finished maps

The active Anchor Lab draft saves automatically shortly after meaningful changes. **Save draft** writes immediately. Wait for the visible Saved status before deliberately closing a fragile browser session.

A draft and a finished map are related but different:

- The draft is the one active editing workspace.
- **Finish map** requires at least two anchors and creates a named My Maps record.
- Once a draft is linked to a finished map, later anchor autosaves also update that saved map's content.
- **Map details** edits its structured metadata.
- Starting fresh replaces the active draft, not the finished record in My Maps.

Metadata includes title, description, place, subject, visual style, map date, activities, source, and private/public-ready intent. Cloud sync alone never publishes it. Public or Unlisted access always requires the separate Share action.

## Use My Maps

Open `/my-maps` to see all active saved records. Search by title, place, type, year, activity, or description.

- **Open map** opens the high-resolution raster viewer.
- **Compare** overlays the map on current geography.
- **Edit anchors** makes that saved map the active Anchor Lab draft and opens the editor.
- **Start another map** enters the safe new-map check before replacing the current draft.

If the same source image was accidentally saved more than once, Field Atlas consolidates exact-source records and preserves the strongest anchor set. Superseded records remain in storage and are not deleted.

## Sign in and privately sync maps

Cloud controls appear when the operator has completed [`CLOUD_SETUP.md`](CLOUD_SETUP.md).

1. Open `/account` and create or sign in to an email/password account.
2. Return to `/my-maps` and find **Private cloud**.
3. Choose **Sync privately** for one map or **Sync all local maps**.
4. Wait for the status message. The existing local image and anchors remain unchanged.
5. On another signed-in device, cloud-only maps appear in the same panel. Choose **Download to device** to checksum-verify and insert that map into the second browser's local library.

Repeated syncs create immutable revisions. If another device changed the same map after this browser's last accepted revision, Field Atlas preserves the new upload as a conflict instead of silently replacing the remote current version. Conflict review UI is planned; keep both local copies and the `.fieldatlas` backup in the meantime.

## Share a map publicly or by link

Community sharing appears after the operator applies all migrations in [`CLOUD_SETUP.md`](CLOUD_SETUP.md).

1. Privately sync the latest map revision first.
2. In the Private cloud list, choose **Share** beside that map.
3. Choose **Public** to list it in Discover immediately, or **Unlisted** to create an immediate secret link that is absent from Discover.
4. Select why you are allowed to share it and add a source, license, or attribution when available. A web source is optional; for a physical map or personal photograph, use the attribution field to explain what you know.
5. Confirm that other people can open the separate shared copy immediately. The unchanged original remains private.
6. Use the returned link or open the public map. **Make private** stops future access without removing local/private-cloud work; it cannot recall a copy someone already downloaded.

Public visitors do not need an account to open the map, use foreground GPS, save it on this device for offline use, visit the uploader profile, or report a problem. A device save is browser-local; it is not an account favorite. Public maps enter the administrator's post-publication queue but do not wait there before becoming usable.

Opening Share again for the exact same synced revision and the same sharing fields shows **Already published**. Field Atlas will not create another publication or process another public image copy until the revision or a sharing choice changes. Switching visibility, rights/source/credit fields, or syncing changed anchors, details, or imagery creates a legitimate new publication.

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

Locations outside the triangulated anchor area are labeled as extrapolated and are less reliable. A point outside the image is not forced onto the map.

## Compare with a current map

Select **Compare** from My Maps or **Compare with today** on a Public or Unlisted map viewer. Compare mode automatically rotates, scales, skews, and locally warps the source using its existing anchors. Public comparison works without an account or device save first.

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

That exact cloud revision and sharing setup are already live. Close the dialog if no update is needed. To publish an update, first edit and sync the map or change a visible sharing field. Use **Make private** only when you intend to stop anonymous access.
