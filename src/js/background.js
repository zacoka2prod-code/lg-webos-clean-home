import {MEDIA_VIDEO, normalizeBackgroundConfig, resolveBackgroundMedia} from './backgrounds.js';
import {AERIAL_BACKGROUNDS} from './aerials.js';
import {resolveLoungePaths} from './usb.js';

const PRESETS = {
  'warm-gradient': 'linear-gradient(135deg, #1a1028 0%, #3d1f2e 40%, #7a3b2e 100%)',
  'cool-gradient': 'linear-gradient(145deg, #0b1220 0%, #162447 50%, #1f4068 100%)',
  'midnight': 'linear-gradient(180deg, #050508 0%, #12121a 60%, #1c1c28 100%)',
  'ember': 'radial-gradient(ellipse at 30% 20%, #4a1942 0%, #1a0a14 50%, #080408 100%)'
};

/** The aerial catalog entry with this URL, or null. */
function aerialClipByUrl(url) {
  for (let i = 0; i < AERIAL_BACKGROUNDS.length; i += 1) {
    if (AERIAL_BACKGROUNDS[i].url === url) return AERIAL_BACKGROUNDS[i];
  }
  return null;
}

/** Where an aerial clip sits in the settings catalog, by its URL (0 when unknown). */
function aerialClipIndexByUrl(url) {
  const clip = aerialClipByUrl(url);
  return clip ? AERIAL_BACKGROUNDS.indexOf(clip) : 0;
}

/** Fisher–Yates copy (aerial Slideshow order). */
function shuffled(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function preloadImage(url) {
  return new Promise(function (resolve) {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    function done(ok) {
      if (settled) return;
      settled = true;
      resolve(!!ok);
    }
    img.onload = function () {
      done(true);
    };
    img.onerror = function () {
      done(false);
    };
    // Older webOS can hang forever on a bad URL — bound the wait.
    setTimeout(function () {
      // naturalWidth > 0 means decode progressed even if onload is flaky.
      done(!!(img.complete && img.naturalWidth > 0));
    }, 8000);
    try {
      img.src = url;
    } catch (err) {
      done(false);
    }
  });
}

export function createBackgroundController(elements, getConfig) {
  const layer = elements.backgroundLayer;
  const scrim = elements.scrim;
  // Whole-picture dimming (#dim), next to the scrim's bottom shade.
  const dim = elements.dim;
  let slideshowTimer = null;
  let slideshowIndex = 0;
  let slideshowMedia = [];
  let usbBackgroundPath = '';
  let refreshGen = 0;
  // Aerial clip: one <video> filling the layer while the source is "aerial".
  let videoEl = null;
  let videoPlaying = false;
  // Aerial Slideshow: the ordered clips and where we are in them.
  let videoClips = [];
  let videoSlideshow = false;
  let videoIndex = 0;
  // Aerial failure handling: failed starts since a clip last played, the id of
  // the load in flight (so a play() rejection and the element's "error" event
  // for the same attempt count once), and whether we've dropped to the gradient.
  let videoFailures = 0;
  let videoAttempt = 0;
  let videoHandledAttempt = 0;
  // Bound to the attempt in flight so the element's "error" event reports the
  // same load as the play() rejection, and a retry detaches the old one.
  let videoErrorListener = null;
  let videoFellBack = false;
  // What the wallpaper on screen was made from (see refresh reuse).
  let appliedSignature = '';

  function applyPreset(name, animated) {
    const gradient = PRESETS[name] || PRESETS['warm-gradient'];
    layer.style.backgroundImage = gradient;
    layer.style.backgroundColor = '#0a0a0f';
    layer.style.backgroundSize = 'cover';
    layer.style.backgroundPosition = 'center center';
    layer.style.backgroundRepeat = 'no-repeat';
    layer.classList.remove('has-image');
    layer.classList.remove('ken-burns');
    layer.classList.toggle('gradient-animated', !!animated);
    syncMovingBackground();
  }

  // Frosted glass over a moving wallpaper is re-blurred every frame (13 fps on
  // a webOS 25 OLED); body.bg-moving swaps the blur for a tint (main.css).
  function syncMovingBackground() {
    document.body.classList.toggle('bg-moving',
      videoPlaying ||
      layer.classList.contains('ken-burns') || layer.classList.contains('gradient-animated'));
  }

  function applyImage(url) {
    const config = getConfig();
    const bg = normalizeBackgroundConfig(config.background);
    // Quote-safe CSS url(); escape backslashes and quotes for file paths.
    const safe = String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    layer.style.backgroundColor = '#0a0a0f';
    layer.style.backgroundImage = 'url("' + safe + '")';
    layer.style.backgroundSize = 'cover';
    layer.style.backgroundPosition = 'center center';
    layer.style.backgroundRepeat = 'no-repeat';
    layer.classList.add('has-image');
    layer.classList.remove('gradient-animated');

    if (bg.kenBurns) {
      layer.classList.add('ken-burns');
    } else {
      layer.classList.remove('ken-burns');
    }
    syncMovingBackground();
  }

  function applyScrim() {
    const config = getConfig();
    const set = config.background && config.background.overlayOpacity;
    // 0 is a value ("no shade"); it used to fall back to 0.45.
    const opacity = typeof set === 'number' ? set : 0.45;
    scrim.style.opacity = String(opacity);
    const dimming = config.background && config.background.dimming;
    if (dim) dim.style.opacity = String(typeof dimming === 'number' ? dimming : 0);
  }

  function clearSlideshow() {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
  }

  function onVideoPlaying() {
    videoPlaying = true;
    videoFailures = 0;
    layer.classList.add('has-video');
    layer.classList.remove('has-image');
    layer.classList.remove('ken-burns');
    syncMovingBackground();
  }

  // Drop the video and put up the configured gradient — what images do when
  // they don't load, so the home screen is never blank.
  function fallbackToGradient(bg) {
    teardownVideo();
    applyPreset(bg.preset || 'warm-gradient', false);
  }

  // How many failed starts to absorb before giving up on aerials: Single gets
  // one retry, Slideshow gets a single pass over the list.
  function maxVideoFailures() {
    return videoSlideshow ? videoClips.length - 1 : 1;
  }

  // A clip would not start (offline, unsupported container). Slideshow skips it
  // and takes the next; Single retries it once. Only when every attempt has
  // failed does the wallpaper drop to the configured gradient.
  function failToGradient(bg) {
    videoFellBack = true;
    // Leave the applied signature cleared so a return (or a settings change)
    // paints aerials again once connectivity is back; until then the gradient
    // holds the screen.
    appliedSignature = '';
    fallbackToGradient(bg);
  }

  function handleVideoFailure(attemptId) {
    // The element's "error" event and the rejected play() both report the same
    // attempt; handle it once. A stale id (a reload already moved on) is ignored.
    if (attemptId !== videoAttempt || attemptId === videoHandledAttempt) return;
    videoHandledAttempt = attemptId;
    // Backgrounded: defer, and let the resume path start the next attempt.
    if (!wallpaperShouldAnimate()) return;
    const bg = normalizeBackgroundConfig(getConfig().background);
    videoFailures += 1;
    if (videoFailures > maxVideoFailures()) {
      failToGradient(bg);
      return;
    }
    if (videoSlideshow) {
      // Skip the broken clip and take the next one round the list.
      videoIndex = (videoIndex + 1) % videoClips.length;
    } else if (videoEl) {
      // Single: retry the same clip. Drop the failed source so playVideoClip
      // re-sets it and the TV makes a fresh request.
      videoEl.removeAttribute('src');
      try { videoEl.load(); } catch (err) { /* ignore */ }
    }
    playVideoClip(bg, refreshGen);
  }

  // Slideshow only: a clip reached its natural end, so roll onto the next one
  // (clips are never cut off by a timer). Looping Single clips never end.
  function onVideoEnded() {
    if (!videoSlideshow || !videoClips.length) return;
    videoIndex = (videoIndex + 1) % videoClips.length;
    playVideoClip(normalizeBackgroundConfig(getConfig().background), refreshGen);
  }

  function ensureVideo() {
    if (videoEl) return videoEl;
    const v = document.createElement('video');
    v.className = 'background-video';
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.autoplay = true;
    v.preload = 'auto';
    v.loop = true;
    v.addEventListener('playing', onVideoPlaying);
    v.addEventListener('ended', onVideoEnded);
    layer.appendChild(v);
    videoEl = v;
    return v;
  }

  // Release the decoder and the network request (source change or teardown).
  function teardownVideo() {
    videoSlideshow = false;
    videoClips = [];
    videoIndex = 0;
    if (!videoEl) return;
    const v = videoEl;
    videoEl = null;
    videoPlaying = false;
    if (videoErrorListener) v.removeEventListener('error', videoErrorListener);
    videoErrorListener = null;
    v.removeEventListener('playing', onVideoPlaying);
    v.removeEventListener('ended', onVideoEnded);
    try { v.pause(); } catch (err) { /* ignore */ }
    v.removeAttribute('src');
    try { v.load(); } catch (err) { /* ignore */ }
    if (v.parentNode) v.parentNode.removeChild(v);
    layer.classList.remove('has-video');
    syncMovingBackground();
  }

  // Whether the wallpaper should be in motion right now. Not while our surface
  // is backgrounded to another app (document.hidden) or while an overlay such as
  // LG Settings holds the remote (body.app-inactive) — the two states that still
  // the 4K photo slideshow and the CSS zoom/gradient in main.css. The in-app
  // Settings panel is neither: the wallpaper is its backdrop, so it keeps moving.
  function wallpaperShouldAnimate() {
    if (document.hidden) return false;
    if (document.body && document.body.classList.contains('app-inactive')) return false;
    return true;
  }

  // Pause the decoder rather than tearing it down, and resume the same stream
  // (play(), never a src change), so returning from an app neither restarts the
  // clip nor re-fetches it. Also starts a first attempt that was skipped while
  // the surface was hidden.
  function syncVideoPlayback() {
    if (!wallpaperShouldAnimate()) {
      if (videoEl && !videoEl.paused) {
        try { videoEl.pause(); } catch (err) { /* ignore */ }
      }
      return;
    }
    if (!videoEl) {
      if (videoClips.length) {
        playVideoClip(normalizeBackgroundConfig(getConfig().background), refreshGen);
      }
      return;
    }
    if (!videoEl.paused) return;
    if (videoEl.error) {
      // The clip broke while we were away: start a fresh attempt (retry/skip)
      // rather than play() the dead element, which would reject silently.
      playVideoClip(normalizeBackgroundConfig(getConfig().background), refreshGen);
      return;
    }
    try {
      const p = videoEl.play();
      if (p && p.catch) p.catch(function () {
        // A source that died while we were away can reject here; if the element
        // now reports an error, make a fresh attempt instead of stalling.
        if (videoEl && videoEl.error) {
          playVideoClip(normalizeBackgroundConfig(getConfig().background), refreshGen);
        }
      });
    } catch (err) { /* ignore */ }
  }

  document.addEventListener('visibilitychange', syncVideoPlayback);
  window.addEventListener('focus', syncVideoPlayback);
  window.addEventListener('blur', syncVideoPlayback);
  // app-inactive is a class flip (main.js) with no event of its own; a body
  // observer catches it the same way main.css reacts to the class.
  const bodyClassObserver = new MutationObserver(syncVideoPlayback);
  if (document.body) {
    bodyClassObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
  }

  // Play videoClips[videoIndex]: looping in Single mode, once in Slideshow (the
  // next clip then rides in on "ended"). True once playing. False when it fell
  // back to the gradient (a return retries) or when the surface is hidden (the
  // resume path starts it instead of decoding for nobody).
  async function playVideoClip(bg, gen) {
    if (!wallpaperShouldAnimate()) return false;
    const attempt = ++videoAttempt;
    const clip = videoClips[videoIndex % videoClips.length];
    const video = ensureVideo();
    video.loop = !videoSlideshow;
    // Bind the "error" event to this load, and detach the previous load's so a
    // late error from a clip we already moved on from is not counted again.
    if (videoErrorListener) video.removeEventListener('error', videoErrorListener);
    videoErrorListener = function () {
      handleVideoFailure(attempt);
    };
    video.addEventListener('error', videoErrorListener);

    // Gradient poster behind the clip until its first frame paints.
    layer.style.backgroundImage = PRESETS[bg.preset] || PRESETS['warm-gradient'];
    layer.style.backgroundColor = '#0a0a0f';
    layer.classList.add('has-video');
    layer.classList.remove('has-image');
    layer.classList.remove('ken-burns');
    layer.classList.remove('gradient-animated');

    if (video.getAttribute('src') !== clip.url) {
      video.setAttribute('src', clip.url);
    }
    try {
      await video.play();
    } catch (err) {
      if (gen !== refreshGen) return false;
      // play() aborted by a pause (the surface hid mid-start) is not a decode
      // failure: keep the element for the resume path, not the gradient.
      if (err && err.name === 'AbortError') return false;
      if (!wallpaperShouldAnimate()) return false;
      handleVideoFailure(attempt);
      return false;
    }
    if (gen !== refreshGen) return false;
    onVideoPlaying();
    return true;
  }

  // Single = loop the chosen clip; Slideshow = cycle the catalog, one clip per
  // "ended". False when it fell back to the gradient (so a return retries).
  async function paintAerial(bg, gen) {
    clearSlideshow();
    const media = await resolveBackgroundMedia(getConfig(), '');
    if (gen !== refreshGen) return false;

    const clips = media.filter(function (item) {
      return item && item.kind === MEDIA_VIDEO && item.url;
    });
    if (!clips.length) {
      failToGradient(bg);
      return false;
    }

    // Offline: don't fire the whole catalog at Apple's CDN; hold the gradient
    // and let a later return try again when connectivity is back.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      failToGradient(bg);
      return false;
    }

    videoSlideshow = bg.mode === 'slideshow' && clips.length > 1;
    videoClips = videoSlideshow && bg.shuffle ? shuffled(clips) : clips;
    videoIndex = 0;
    videoFailures = 0;
    videoHandledAttempt = 0;
    const ok = await playVideoClip(bg, gen);
    return ok && !videoFellBack;
  }

  /**
   * Channel Up / Channel Down (and Blue) on an aerial wallpaper: step to the
   * next / previous clip. Single steps the settings catalog and is remembered
   * by the host; Slideshow steps the order actually playing (shuffled if
   * enabled). Returns the landed clip ({id, title, mode}) or null when there is
   * nothing to switch to (source not aerial, no clip loaded, or the gradient
   * fallback). The jump is a hard cut: the chosen clip is loaded into the one
   * <video> buffer and played.
   */
  function stepAerial(direction) {
    const dir = direction < 0 ? -1 : 1;
    const bg = normalizeBackgroundConfig(getConfig().background);
    if (bg.source !== 'aerial') return null;
    if (videoFellBack) return null;
    if (!videoClips.length) return null;

    let clip;
    if (videoSlideshow) {
      if (videoClips.length < 2) return null;
      videoIndex = (videoIndex + dir + videoClips.length) % videoClips.length;
      clip = videoClips[videoIndex];
    } else {
      const current = videoClips[videoIndex % videoClips.length];
      const catalogIndex = aerialClipIndexByUrl(current.url);
      const nextIndex =
        (catalogIndex + dir + AERIAL_BACKGROUNDS.length) % AERIAL_BACKGROUNDS.length;
      clip = AERIAL_BACKGROUNDS[nextIndex];
      // Single plays one clip: swap in the landed clip as the one on screen.
      videoClips = [{kind: MEDIA_VIDEO, url: clip.url}];
      videoIndex = 0;
    }
    if (!clip || !clip.url) return null;
    // Slideshow descriptors carry only {kind, url}: resolve id/title from the
    // catalog so the toast and Single-mode persistence have them.
    const resolved = aerialClipByUrl(clip.url) || clip;

    // A manual pick starts clean: don't inherit a pending failure count.
    videoFailures = 0;
    videoHandledAttempt = 0;
    playVideoClip(bg, refreshGen);

    const change = {
      id: resolved.id || '',
      title: resolved.title || '',
      mode: videoSlideshow ? 'slideshow' : 'single'
    };
    // Tell the host first so its persistence (Single) lands before we fold the
    // new choice into the signature — a later return then reuses this clip.
    if (elements.onAerialChange) elements.onAerialChange(change);
    appliedSignature = configSignature();
    return change;
  }

  function showSlideshowImage() {
    if (!slideshowMedia.length) return;
    applyImage(slideshowMedia[slideshowIndex % slideshowMedia.length].url);
    slideshowIndex += 1;
  }

  // Not while another app or TV Settings (an overlay) is in front: the next
  // 4K photo would be decoded and drawn underneath for nobody to see.
  function slideshowTick() {
    if (!wallpaperShouldAnimate()) return;
    showSlideshowImage();
  }

  function startSlideshow(media, intervalSec) {
    slideshowMedia = media;
    slideshowIndex = 0;
    showSlideshowImage();
    slideshowTimer = setInterval(slideshowTick, intervalSec * 1000);
  }

  /**
   * Try each candidate URL until one decodes. webOS 4 may reject one form of
   * path but accept another (relative vs absolute file://).
   */
  async function pickLoadableMedia(candidates) {
    for (let i = 0; i < candidates.length; i += 1) {
      const item = candidates[i];
      if (!item || !item.url) continue;
      // Apply optimistically so the user sees something while we verify.
      applyImage(item.url);
      const ok = await preloadImage(item.url);
      if (ok) return item;
    }
    return null;
  }

  // The online wallpaper link last reported as not loading (once per link).
  let reportedFailure = '';

  /**
   * An online wallpaper didn't load: say so once per link. Without this the
   * home screen quietly showed a gradient, which read as "the wallpaper
   * setting does nothing" (seen with an image host's page link pasted in
   * place of the image's own link).
   */
  function reportOnlineFailure(bg, images) {
    if (bg.source !== 'url') return;
    const key = images.join(' ');
    if (key === reportedFailure) return;
    reportedFailure = key;
    if (elements.onToast) {
      elements.onToast('The wallpaper link didn\u2019t load as an image. Use a direct image link ' +
        '(it usually ends in .jpg or .png), and check the TV is online.');
    }
  }

  /**
   * @param {{reuse?: boolean}} [opts] reuse: returning from an app. When the
   *   wallpaper settings are unchanged it is already on screen (a slideshow
   *   keeps going); loading it again decoded the 4K photo and asked the TV for
   *   USB folders on every return, which slow TVs felt as lag.
   */
  // What the wallpaper on screen was made from. Computed from the resolved
  // config so a remote clip switch can be folded in after it is persisted.
  function configSignature(config) {
    const c = config || getConfig();
    return JSON.stringify([
      c.background || {}, c.profile || '', !!(c.launcher && c.launcher.perfMode)
    ]);
  }

  async function refresh(opts) {
    const config = getConfig();
    const signature = configSignature(config);
    if (opts && opts.reuse && appliedSignature && signature === appliedSignature) {
      applyScrim();
      // Returning from an app: the clip is already loaded (unpainted changes are
      // ignored), so just resume the decoder we paused on the way out.
      syncVideoPlayback();
      return;
    }
    appliedSignature = '';
    const gen = ++refreshGen;
    const ok = await paint(config, gen);
    // Not while the aerial fell back to its gradient: leaving the signature
    // unset is what lets a later return retry the clips once online.
    if (ok && gen === refreshGen && !videoFellBack) appliedSignature = signature;
  }

  // Put the configured wallpaper up. False when it fell back to a gradient
  // because the pictures didn't load (a return then tries them again).
  async function paint(config, gen) {
    clearSlideshow();
    videoFellBack = false;
    applyScrim();

    const bg = normalizeBackgroundConfig(config.background);

    if (bg.source === 'preset' || bg.source === 'animated-gradient') {
      teardownVideo();
      applyPreset(bg.preset || 'warm-gradient', bg.source === 'animated-gradient');
      return true;
    }

    if (bg.source === 'aerial') {
      return paintAerial(bg, gen);
    }

    // Left the aerial source: release the decoder before painting photos.
    teardownVideo();

    if (!usbBackgroundPath) {
      const paths = await resolveLoungePaths(config);
      if (gen !== refreshGen) return false;
      usbBackgroundPath = paths.backgroundPath || '';
    }

    const media = await resolveBackgroundMedia(config, usbBackgroundPath);
    if (gen !== refreshGen) return false;

    if (!media.length) {
      applyPreset(bg.preset || 'warm-gradient', false);
      return false;
    }

    if (bg.mode === 'slideshow' && media.length > 1) {
      // Verify at least the first image loads; still run the full list.
      const first = await pickLoadableMedia(media);
      if (gen !== refreshGen) return false;
      if (!first) {
        applyPreset(bg.preset || 'warm-gradient', false);
        reportOnlineFailure(bg, images);
        return false;
      }
      startSlideshow(media, bg.slideshowIntervalSec || 300);
      return true;
    }

    const loaded = await pickLoadableMedia(media);
    if (gen !== refreshGen) return false;
    if (!loaded) {
      applyPreset(bg.preset || 'warm-gradient', false);
      reportOnlineFailure(bg, images);
      return false;
    }
    reportedFailure = '';
    return true;
  }

  return {
    refresh: refresh,
    stepAerial: stepAerial,
    destroy: function () {
      clearSlideshow();
      teardownVideo();
      document.removeEventListener('visibilitychange', syncVideoPlayback);
      window.removeEventListener('focus', syncVideoPlayback);
      window.removeEventListener('blur', syncVideoPlayback);
      bodyClassObserver.disconnect();
    }
  };
}
