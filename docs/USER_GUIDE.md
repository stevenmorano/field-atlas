# User guide

Status: working local prototype  
Last reviewed: 2026-08-10

## Important storage warning

Your working library is stored in this browser profile on this website origin. Before clearing site data or switching browsers/devices, open My Maps and choose **Back up all maps**. Keep the downloaded `.fieldatlas` file somewhere private and import it in the destination browser. Field Atlas does not synchronize it automatically.

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

Metadata includes title, description, place, subject, visual style, map date, activities, source, and private/public-ready intent. Public-ready is only a label in this prototype; it does not upload or publish anything.

## Use My Maps

Open `/my-maps` to see all active saved records. Search by title, place, type, year, activity, or description.

- **Open map** opens the high-resolution raster viewer.
- **Compare** overlays the map on current geography.
- **Edit anchors** makes that saved map the active Anchor Lab draft and opens the editor.
- **Start another map** enters the safe new-map check before replacing the current draft.

If the same source image was accidentally saved more than once, Field Atlas consolidates exact-source records and preserves the strongest anchor set. Superseded records remain in storage and are not deleted.

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

Select **Compare** from My Maps or the viewer. Compare mode automatically rotates, scales, skews, and locally warps the source using its existing anchors.

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
