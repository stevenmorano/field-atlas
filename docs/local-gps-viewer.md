# Local GPS viewer

Status: implemented  
Last reviewed: 2026-08-12

## Accepted outcome

The viewer opens a saved raster map as the main canvas and projects the device's current browser location onto it. It is a map-reading tool, not navigation: there are no routes, tracks, background recording, or location sharing.

The implemented slice includes:

- **Open map** from My Maps;
- full-resolution pan, wheel/button zoom, and touch gestures;
- user-initiated **Find me**;
- a blue position dot and locally transformed accuracy area;
- recentering plus warnings outside the anchored mesh or image;
- permission, timeout, availability, and unsupported-browser messages;
- local reopening and anonymous use of downloaded Public/Unlisted maps; and
- links to Compare and anchor editing.

## Assumptions and requirements

- GPS readings and history are never written to browser storage, analytics, URLs, or a server.
- The watch exists only while the viewer is open and visible.
- Opening a map is read-only for its anchors and metadata.
- The original high-resolution Blob remains the zoom source.
- Two anchors can estimate location, but extrapolated positions are explicitly lower confidence.
- The map remains usable without location permission.
- Geolocation normally requires HTTPS; `localhost` is accepted for development, while embedded browsers may block it.

## Selected approach

The browser Geolocation API feeds the existing inverse georeference model entirely in memory. This reuses the same triangulated correction created in Anchor Lab and keeps the uploaded map visually primary.

Alternatives rejected for this slice were making a live basemap the primary viewer and sending GPS to a server. Compare mode now covers the first alternative as a separate visual tool; server-side projection would add privacy risk and latency without improving the math.

## Interaction design

1. Load the saved Blob and anchors from IndexedDB.
2. Fit the source map in the available viewer.
3. **Find me** begins a high-accuracy watch while visible.
4. Convert each longitude/latitude reading through Web Mercator and the inverse model into source pixels.
5. Project small geographic offsets to estimate the image-space accuracy ellipse.
6. Recenter on the first on-image reading. Manual panning disables follow mode; **Recenter** restores it.
7. If a point is extrapolated or outside the image, explain the limitation rather than forcing it onto the map.

## Decision log

- The uploaded image is the primary viewer.
- GPS is explicitly initiated and ephemeral.
- A live watch runs only while the viewer is visible.
- Poor accuracy and extrapolation are shown honestly.
- The viewer never uploads GPS; navigation, routes, track history, and location sharing remain out of scope.
