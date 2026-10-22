# Background image sources

Launch Home can show backgrounds from:

1. **Built-in photos** — 5 premium **~3840px** JPEGs packaged under `assets/backgrounds/` (offline), sharp on 4K TVs. Online URL streams additional ~3840px photos without growing the package further. With **Performance mode** on, Launch Home uses 1920px versions instead, about a quarter of the pixels to decode, for slower TVs: online photos are requested at 1920px, and the built-ins' 1920px copies (`assets/backgrounds/1920/`, not packaged in the IPK) are downloaded from this repo via jsDelivr and cached. Offline, the packaged 4K originals are used.
2. **USB folder** — files on a stick (`lounge/backgrounds/` + optional `images.json`)
3. **Online URL** — direct `https://` image links (Unsplash nature, Wallhaven anime, Pexels, your CDN) — **not** stored in the package
4. **Aerial videos** — Apple's aerial/screensaver clips, **hotlinked** from Apple's CDN and streamed as video (not stored in the package). See [Aerial videos](#aerial-videos).
5. **Gradients** — CSS presets (no images)

Prefer **Online URL** when you want more variety without growing the IPK.

## Using online photos in the app

1. Open **Settings → Background**
2. Set **Source** to the catalog you want (only that gallery is shown):
   - **Built-in photos** → **Choose a built-in photo** thumbnail grid (packaged JPEGs)
   - **Online URL (nature + anime)** → **Choose an online photo** grid (nature + anime), or **Custom URL** + **Image URL**
3. For slideshow: set **Display** to **Slideshow**. Leave **Slideshow URLs** empty (online) to cycle the curated remote set, or paste one `https://` URL per line.
4. Built-in and online selections are independent — picking Mountain Sunset (built-in) does not change the online pick, and the online gallery is hidden while Source is Built-in.

**Requirements:** TV must have network access. Use **direct image URLs** (ending in a real JPEG/WebP response), not HTML gallery pages.

**Fallback:** If a remote image fails to load (offline, TLS, 404), the launcher falls back to a gradient after a short timeout.

## Curated remote set

**39 online-only photos** in `src/js/backgrounds.js` (`REMOTE_BACKGROUNDS`):

| Set | Count | Host | Notes |
|-----|------:|------|--------|
| Luxury tropical beaches | 4 | Unsplash CDN | Palms, sun, shoreline — first in the online gallery |
| SpaceX rockets | 2 | X image CDN, Unsplash CDN | Starship launch at Starbase (an image posted on X, `pbs.twimg.com/media/HTU8ja-XgAE6GwQ`); Falcon Heavy launch (SpaceX on Unsplash) |
| Nature / travel | 23 | Unsplash / Wallhaven | Scenic remote set (no alpine snow) |
| Anime girls | 12 | Wallhaven CDN | Popular SFW smiling face / fun portraits (`w.wallhaven.cc`) |

They are **not** the built-in pack — Settings → **Online URL** shows only this network gallery (plus Custom URL). Built-in photos appear only under **Built-in photos**.

No image bytes are shipped in the package; the TV loads them over HTTPS.

To extend or replace the set, edit `REMOTE_BACKGROUNDS` (id, title, direct `https://…` image URL).

**Licenses / usage**

- Unsplash: [Unsplash License](https://unsplash.com/license) (free commercial use; no attribution required).
- Wallhaven anime set: free wallpaper downloads via the public CDN (user-uploaded art). Fine for personal TV wallpapers; not an Unsplash-style commercial stock license. Hotlinked only (not redistributed in the `.ipk`).
- Starship launch: SpaceX launch photography as posted on X, hotlinked from X's image CDN (not redistributed in the `.ipk`). It stays available only while the post does.

## Aerial videos

Apple's aerial/screensaver clips play as a **video** background — muted, full-screen and looping, on both the home screen and the in-app screensaver. They stream from Apple's CDN, so nothing is packaged in the `.ipk`.

1. Open **Settings → Background**
2. Set **Source** to **Aerial videos (Apple)**
3. Set **Display**:
   - **Single image** → **Choose an aerial clip** picks one clip, which loops
   - **Slideshow** → plays through the whole catalog, each clip running to its own end (the slideshow interval and **Slow zoom background** do not apply to video); turn on **Shuffle clips** to randomise the order

**Requirements:** the TV must be online. Each clip is a full video download plus continuous decoding, so aerials are much heavier than a photo. **Performance mode** does not change this — it only affects photo resolution, not video.

**Fallback:** if a clip will not load, Single retries once and Slideshow skips to the next clip; if every attempt fails (offline, blocked, clip removed by Apple), the launcher falls back to a gradient rather than a blank screen.

**License / usage:** the clips are hotlinked from Apple's CDN and are **not redistributed in the app package**, the same stance as the X (Starship) and Wallhaven entries above. They remain available only while Apple keeps hosting them, so this source can change or stop working over time.

To extend or replace the catalog, edit `AERIAL_BACKGROUNDS` in `src/js/aerials.js` (id, title, direct `https://…` clip URL).

## Adding your own remote URLs

Any host works if it serves a **direct** image over HTTPS, for example:

- Unsplash: `https://images.unsplash.com/photo-…?w=3840&q=92&auto=format&fit=crop`
- Pexels: `https://images.pexels.com/photos/…/pexels-photo-….jpeg?auto=compress&cs=tinysrgb&w=3840`
- Wallhaven: `https://w.wallhaven.cc/full/ab/wallhaven-abcdef.jpg` (settings thumbs map automatically)
- Your own server / GitHub raw / S3, etc.

To extend the in-app picker, add entries to `REMOTE_BACKGROUNDS` in `src/js/backgrounds.js` (id, title, url only). For more anime picks, use Wallhaven’s SFW anime filter and paste the full image URL.

## Why not package more JPEGs?

Each 4K wallpaper is ~1–3 MB. Streaming from a CDN keeps the `.ipk` smaller and lets you change the catalog without rebuilding assets. Built-ins remain available for offline TVs.
