/**
 * In-app screensaver for Launch Home.
 *
 * After idle timeout while Launch Home is foreground, shows a full-screen
 * photo slideshow (from the same background sources as the home wallpaper)
 * with an optional large clock. Any remote key / pointer dismisses it.
 *
 * Runs only inside this app — does not replace the system-wide LG saver when
 * other apps are open. When active, motion (slideshow + slow Ken Burns) helps
 * OLED burn-in protection and makes the system saver less likely to steal focus.
 */

import {setClockTime} from './clock-format.js';
import {MEDIA_VIDEO, normalizeBackgroundConfig, resolveBackgroundMedia} from './backgrounds.js';
import {resolveLoungePaths} from './usb.js';

const PRESETS = {
  'warm-gradient': 'linear-gradient(135deg, #1a1028 0%, #3d1f2e 40%, #7a3b2e 100%)',
  'cool-gradient': 'linear-gradient(145deg, #0b1220 0%, #162447 50%, #1f4068 100%)',
  'midnight': 'linear-gradient(180deg, #050508 0%, #12121a 60%, #1c1c28 100%)',
  'ember': 'radial-gradient(ellipse at 30% 20%, #4a1942 0%, #1a0a14 50%, #080408 100%)'
};

function formatDate(date, timezone) {
  const options = {weekday: 'long', day: 'numeric', month: 'long'};
  if (timezone) options.timeZone = timezone;
  try {
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  } catch (err) {
    delete options.timeZone;
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }
}

/** Fisher–Yates copy (aerial Slideshow order, like the home wallpaper). */
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

/**
 * @param {object} options
 * @param {HTMLElement} options.rootEl
 * @param {() => object} options.getConfig
 * @param {() => boolean} [options.isBlocked]  true while settings open / not foreground
 * @param {() => void} [options.onShow]
 * @param {() => void} [options.onHide]
 */
export function createCustomScreensaver(options) {
  const rootEl = options.rootEl;
  const getConfig = options.getConfig;
  const isBlocked = typeof options.isBlocked === 'function'
    ? options.isBlocked
    : function () { return false; };
  const onShow = options.onShow || function () {};
  const onHide = options.onHide || function () {};

  if (!rootEl) {
    return {
      start: function () {},
      stop: function () {},
      resetIdle: function () {},
      isActive: function () { return false; },
      applyConfig: function () {}
    };
  }

  const bgA = rootEl.querySelector('.custom-screensaver-bg-a');
  const bgB = rootEl.querySelector('.custom-screensaver-bg-b');
  const timeEl = rootEl.querySelector('.custom-screensaver-time');
  const dateEl = rootEl.querySelector('.custom-screensaver-date');

  let active = false;
  let stopped = true;
  let idleTimer = null;
  let slideTimer = null;
  let clockTimer = null;
  let images = [];
  let slideIndex = 0;
  let useA = true;
  let dismissArmed = false;
  let loadGen = 0;
  let slideGen = 0;
  let decodingPhoto = null;
  let usbBackgroundPath = '';

  // Aerial clip: one <video> over the photo layers while the source is "aerial".
  // Single loops the chosen clip (retrying once, like the home wallpaper) and
  // Slideshow rides "ended" onto the next. The two ids guard against an error
  // event and a rejected play() for the same load being handled twice; the
  // failure count drops to a gradient only after every attempt has failed.
  let videoEl = null;
  let videoClips = [];
  let videoSlideshow = false;
  let videoIndex = 0;
  let videoAttempt = 0;
  let videoHandledAttempt = 0;
  let videoErrorListener = null;
  let videoFailures = 0;

  // app-inactive is a class flip (main.js) with no event of its own; a body
  // observer catches it the same way the home wallpaper's does.
  const bodyClassObserver = new MutationObserver(function () { syncVideo(); });

  function cfg() {
    const launcher = (getConfig().launcher) || {};
    return {
      enabled: launcher.customScreensaver !== false,
      idleMinutes: typeof launcher.customScreensaverMinutes === 'number'
        ? launcher.customScreensaverMinutes
        : 5,
      slideSec: typeof launcher.customScreensaverSlideSec === 'number'
        ? launcher.customScreensaverSlideSec
        : 20,
      showClock: launcher.customScreensaverShowClock !== false,
      showDate: launcher.customScreensaverShowDate !== false,
      timezone: launcher.timezone || ''
    };
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function clearSlideTimer() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  function clearClockTimer() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function paintClock() {
    const c = cfg();
    const now = new Date();
    if (timeEl) {
      if (c.showClock) setClockTime(timeEl, now, c.timezone, c.clockFormat === '12');
      else timeEl.textContent = '';
      timeEl.hidden = !c.showClock;
    }
    if (dateEl) {
      dateEl.textContent = c.showDate ? formatDate(now, c.timezone) : '';
      dateEl.hidden = !c.showDate;
    }
  }

  function applyLayer(el, urlOrGradient, isGradient) {
    if (!el) return;
    if (isGradient) {
      el.style.backgroundImage = urlOrGradient;
      el.classList.remove('is-photo');
    } else {
      const safe = String(urlOrGradient).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      el.style.backgroundImage = 'url("' + safe + '")';
      el.classList.add('is-photo');
    }
  }

  /**
   * Resolve once a photo is downloaded and decoded (or after a timeout), so
   * the crossfade never starts on a photo that is still decoding.
   * The element is kept until the next slide so the decoded copy stays warm.
   */
  function decodePhoto(url) {
    return new Promise(function (resolve) {
      const img = new Image();
      let settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      img.onload = function () {
        if (typeof img.decode === 'function') {
          img.decode().then(done, done);
        } else {
          done();
        }
      };
      img.onerror = done;
      setTimeout(done, 6000);
      decodingPhoto = img;
      img.src = url;
    });
  }

  function showSlide(index) {
    if (!images.length) return;
    const item = images[index % images.length];
    const gen = ++slideGen;
    const ready = item.gradient ? Promise.resolve() : decodePhoto(item.url);
    ready.then(function () {
      if (gen !== slideGen || !active) return;
      const front = useA ? bgA : bgB;
      const back = useA ? bgB : bgA;
      applyLayer(back, item.url, item.gradient);
      // Cross-fade: back fades in on top, then the old front drops out.
      if (back) {
        back.classList.add('is-front');
        back.classList.remove('is-back');
      }
      if (front) {
        front.classList.remove('is-front');
        front.classList.add('is-back');
      }
      useA = !useA;
    });
  }

  /**
   * Resolve what to show while the saver is up: aerial clips (video) when the
   * source is aerial, otherwise the photo list (with the motion-friendly
   * multi-image probe). Returns {kind:'video', clips, slideshow, shuffle} or
   * {kind:'images', items}.
   */
  async function loadContent() {
    const gen = ++loadGen;
    const config = getConfig();
    const bg = normalizeBackgroundConfig(config.background);

    if (bg.source === 'aerial') {
      // The clips are CDN-only; offline, don't stall on a black screen waiting
      // for Apple — an empty clip list falls back to the gradient below.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {kind: 'video', clips: []};
      }
      let list = [];
      try {
        list = await resolveBackgroundMedia(config, '');
      } catch (err) {
        list = [];
      }
      if (gen !== loadGen) return null;
      const clips = list.filter(function (item) {
        return item && item.kind === MEDIA_VIDEO && item.url;
      });
      // Single/Slideshow/Shuffle are honoured exactly as the home wallpaper does.
      return {
        kind: 'video',
        clips: clips,
        slideshow: bg.mode === 'slideshow' && clips.length > 1,
        shuffle: !!bg.shuffle
      };
    }

    const out = [];

    if (bg.source === 'preset' || bg.source === 'animated-gradient') {
      const grad = PRESETS[bg.preset] || PRESETS['warm-gradient'];
      out.push({url: grad, gradient: true});
      return {kind: 'images', items: out};
    }

    if (!usbBackgroundPath) {
      try {
        const paths = await resolveLoungePaths(config);
        if (gen !== loadGen) return null;
        usbBackgroundPath = paths.backgroundPath || '';
      } catch (err) {
        usbBackgroundPath = '';
      }
    }

    // Prefer a multi-image set for motion (OLED-friendly). Temporarily force
    // slideshow mode when resolving so builtin/url catalogs return the full list.
    const probe = JSON.parse(JSON.stringify(config));
    if (!probe.background) probe.background = {};
    if (probe.background.source === 'builtin' || probe.background.source === 'url') {
      probe.background.mode = 'slideshow';
    }

    let list = [];
    try {
      list = await resolveBackgroundMedia(probe, usbBackgroundPath);
    } catch (err) {
      list = [];
    }
    if (gen !== loadGen) return null;

    if (!list.length) {
      // Fall back to whatever the home wallpaper would use (single image).
      try {
        list = await resolveBackgroundMedia(config, usbBackgroundPath);
      } catch (err2) {
        list = [];
      }
    }
    if (gen !== loadGen) return null;

    // Deduplicate while preserving order. Video never reaches here (aerial is
    // handled above); the guard keeps a stray clip out of the photo cross-fade.
    const seen = {};
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || !item.url || item.kind === MEDIA_VIDEO || seen[item.url]) continue;
      seen[item.url] = true;
      out.push({kind: item.kind, url: item.url, gradient: false});
    }

    if (!out.length) {
      out.push({url: PRESETS.midnight, gradient: true});
    }
    return {kind: 'images', items: out};
  }

  function startSlideshow() {
    clearSlideTimer();
    // show() already painted the current photo on the front layer; fading it
    // into a second copy of itself read as a zoom jump.
    if (images.length <= 1) return;
    const sec = Math.max(8, cfg().slideSec || 20);
    slideTimer = setInterval(function () {
      slideIndex += 1;
      showSlide(slideIndex);
    }, sec * 1000);
  }

  // Paint an image or gradient on the front layer and reset the back layer, so
  // the crossfade always starts from a clean pair.
  function showImageFrame(urlOrGradient, isGradient) {
    if (bgA) {
      bgA.classList.add('is-front');
      bgA.classList.remove('is-back');
      applyLayer(bgA, urlOrGradient, isGradient);
    }
    if (bgB) {
      bgB.classList.add('is-back');
      bgB.classList.remove('is-front');
    }
  }

  function startImageContent(list) {
    // Coming from aerials: drop the clip so it does not play over the photos.
    teardownVideo();
    images = list;
    slideIndex = 0;
    useA = true;
    // Paint first frame immediately (crossfade starts empty otherwise).
    if (list[0]) showImageFrame(list[0].url, list[0].gradient);
    startSlideshow();
  }

  function ensureVideo() {
    if (videoEl) return videoEl;
    const v = document.createElement('video');
    v.className = 'custom-screensaver-video';
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
    rootEl.appendChild(v);
    videoEl = v;
    return v;
  }

  // Release the decoder and the network request (leaving the saver, or the
  // surface backgrounding — main.js hides the saver when document.hidden).
  function teardownVideo() {
    videoAttempt += 1; // drop any play()/error still in flight
    videoFailures = 0;
    videoClips = [];
    videoSlideshow = false;
    videoIndex = 0;
    if (!videoEl) return;
    const v = videoEl;
    videoEl = null;
    if (videoErrorListener) v.removeEventListener('error', videoErrorListener);
    videoErrorListener = null;
    v.removeEventListener('playing', onVideoPlaying);
    v.removeEventListener('ended', onVideoEnded);
    try { v.pause(); } catch (err) { /* ignore */ }
    v.removeAttribute('src');
    try { v.load(); } catch (err) { /* ignore */ }
    if (v.parentNode) v.parentNode.removeChild(v);
  }

  // A clip started: a run of failures is over.
  function onVideoPlaying() {
    videoFailures = 0;
  }

  function onVideoEnded() {
    if (!videoSlideshow || videoClips.length <= 1) return;
    videoIndex = (videoIndex + 1) % videoClips.length;
    playVideo();
  }

  function playVideo() {
    if (!videoEl || !videoClips.length) return;
    const attempt = ++videoAttempt;
    const clip = videoClips[videoIndex % videoClips.length];
    videoEl.loop = !videoSlideshow;
    // Bind "error" to this load; detach the previous so a late error from a
    // clip we already left is not counted again.
    if (videoErrorListener) videoEl.removeEventListener('error', videoErrorListener);
    videoErrorListener = function () {
      handleVideoFailure(attempt);
    };
    videoEl.addEventListener('error', videoErrorListener);
    if (videoEl.getAttribute('src') !== clip.url) {
      videoEl.setAttribute('src', clip.url);
    }
    // Reveal now rather than waiting on a "playing" event: the element's own
    // background (dark, like the saver) covers the first-frame gap, and a clip
    // that never reports "playing" still shows.
    videoEl.classList.add('is-visible');
    let p = null;
    try {
      p = videoEl.play();
    } catch (err) {
      handleVideoFailure(attempt);
      return;
    }
    if (p && p.catch) p.catch(function (err) {
      // Aborted by a pause (the saver closed mid-start) is not a decode failure.
      if (err && err.name === 'AbortError') return;
      handleVideoFailure(attempt);
    });
  }

  // Whether the clip should be decoding right now. Not while our surface is
  // backgrounded to another app (document.hidden) or while an overlay such as
  // LG Settings holds the remote (body.app-inactive) — the same two states the
  // home wallpaper uses.
  function saverShouldPlay() {
    if (document.hidden) return false;
    if (document.body && document.body.classList.contains('app-inactive')) return false;
    return true;
  }

  // Pause on hidden/inactive and resume the same stream (play(), never a src
  // change, so returning neither restarts the clip nor re-fetches it).
  function syncVideo() {
    if (!active || !videoEl || !videoClips.length) return;
    if (!saverShouldPlay()) {
      if (!videoEl.paused) {
        try { videoEl.pause(); } catch (err) { /* ignore */ }
      }
      return;
    }
    if (!videoEl.paused) return;
    if (videoEl.error) {
      playVideo();
      return;
    }
    try {
      const p = videoEl.play();
      if (p && p.catch) p.catch(function () { /* resumed elsewhere */ });
    } catch (err) { /* ignore */ }
  }

  // Single gets one retry; Slideshow gets a single pass over the list.
  function maxVideoFailures() {
    return videoSlideshow ? videoClips.length - 1 : 1;
  }

  // A clip that will not play: Slideshow skips to the next one, Single retries
  // the same clip once, and only once every attempt has failed does the saver
  // drop to the gradient (never blank). The element's error event and a rejected
  // play() report the same attempt, so it is handled once.
  function handleVideoFailure(attemptId) {
    // Backgrounded/inactive: defer, and let syncVideo retry on the way back.
    if (!active || !saverShouldPlay()) return;
    if (attemptId !== videoAttempt || attemptId === videoHandledAttempt) return;
    videoHandledAttempt = attemptId;
    videoFailures += 1;
    if (videoFailures > maxVideoFailures()) {
      showVideoFallback();
      return;
    }
    if (videoSlideshow) {
      // Skip the broken clip and take the next one round the list.
      videoIndex = (videoIndex + 1) % videoClips.length;
    } else if (videoEl) {
      // Single: retry the same clip. Drop the failed source so playVideo re-sets
      // it and the TV makes a fresh request.
      videoEl.removeAttribute('src');
      try { videoEl.load(); } catch (err) { /* ignore */ }
    }
    playVideo();
  }

  function showVideoFallback() {
    teardownVideo();
    clearSlideTimer();
    images = [{url: PRESETS.midnight, gradient: true}];
    showImageFrame(PRESETS.midnight, true);
  }

  function startVideoContent(content) {
    images = [];
    clearSlideTimer();
    if (!content.clips.length) {
      showVideoFallback();
      return;
    }
    videoSlideshow = !!content.slideshow;
    videoClips = videoSlideshow && content.shuffle ? shuffled(content.clips) : content.clips;
    videoIndex = 0;
    videoAttempt = 0;
    videoHandledAttempt = 0;
    videoFailures = 0;
    ensureVideo();
    playVideo();
  }

  // Load and start whatever the current settings call for; used on show and when
  // the settings change while the saver is up.
  async function beginContent() {
    const content = await loadContent();
    if (!active || !content) return;
    if (content.kind === 'video') startVideoContent(content);
    else startImageContent(content.items);
  }

  function show(opts) {
    const force = !!(opts && opts.force);
    if (active) return;
    if (stopped) {
      if (!force) return;
      // Force preview: start listeners first.
      stopped = false;
      attachListeners();
    }
    if (!force) {
      if (isBlocked()) return;
      if (!cfg().enabled) return;
    }

    active = true;
    dismissArmed = false;
    clearIdleTimer();
    rootEl.hidden = false;
    rootEl.removeAttribute('hidden');
    rootEl.setAttribute('aria-hidden', 'false');
    rootEl.classList.add('visible');
    // Instant paint — no wait for CSS transition opacity 0→1 on first frame.
    rootEl.style.opacity = '1';
    document.body.classList.add('custom-screensaver-active');

    paintClock();
    clearClockTimer();
    clockTimer = setInterval(paintClock, 15000);

    beginContent();

    // Ignore the key/click that might still be settling; arm dismiss shortly.
    // Force previews stay up longer before dismiss is armed (remote bounce).
    setTimeout(function () {
      if (active) dismissArmed = true;
    }, force ? 1200 : 400);

    try { onShow(); } catch (err) { /* ignore */ }
  }

  function hide() {
    if (!active) return;
    active = false;
    dismissArmed = false;
    slideGen += 1; // drop any crossfade still waiting on a decode
    teardownVideo();
    clearSlideTimer();
    clearClockTimer();
    rootEl.classList.remove('visible');
    rootEl.style.opacity = '';
    rootEl.setAttribute('aria-hidden', 'true');
    rootEl.hidden = true;
    rootEl.setAttribute('hidden', '');
    document.body.classList.remove('custom-screensaver-active');
    try { onHide(); } catch (err) { /* ignore */ }
    scheduleIdle();
  }

  function scheduleIdle() {
    clearIdleTimer();
    if (stopped || active) return;
    if (!cfg().enabled) return;
    if (isBlocked()) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    let mins = cfg().idleMinutes;
    if (isNaN(mins) || mins < 1) mins = 5;
    if (mins > 180) mins = 180;
    idleTimer = setTimeout(function () {
      idleTimer = null;
      show();
    }, mins * 60 * 1000);
  }

  function resetIdle() {
    if (active) {
      if (dismissArmed) hide();
      return;
    }
    scheduleIdle();
  }

  function isWakeEvent(event) {
    if (!event) return true;
    const t = event.type || '';
    // Magic Remote pointer drift should not dismiss; real presses / keys do.
    return t === 'keydown' || t === 'keyup' || t === 'pointerdown' ||
      t === 'mousedown' || t === 'click' || t === 'wheel' || t === 'touchstart';
  }

  function onActivity(event) {
    if (stopped) return;
    if (active) {
      // Swallow all input while up so nothing under the overlay (dock tiles,
      // or Settings during a preview) reacts — including before dismiss arms.
      if (event) {
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (err) { /* ignore */ }
      }
      if (dismissArmed && isWakeEvent(event)) hide();
      return;
    }
    scheduleIdle();
  }

  // Dismiss/activity listeners plus the video lifecycle drivers. Attached once
  // on start (or a force preview) and removed on stop.
  function attachListeners() {
    document.addEventListener('keydown', onActivity, true);
    document.addEventListener('keyup', onActivity, true);
    document.addEventListener('pointerdown', onActivity, true);
    document.addEventListener('mousedown', onActivity, true);
    document.addEventListener('click', onActivity, true);
    document.addEventListener('wheel', onActivity, true);
    document.addEventListener('mousemove', onActivity, true);
    document.addEventListener('touchstart', onActivity, true);
    document.addEventListener('visibilitychange', syncVideo);
    bodyClassObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
  }

  function detachListeners() {
    document.removeEventListener('keydown', onActivity, true);
    document.removeEventListener('keyup', onActivity, true);
    document.removeEventListener('pointerdown', onActivity, true);
    document.removeEventListener('mousedown', onActivity, true);
    document.removeEventListener('click', onActivity, true);
    document.removeEventListener('wheel', onActivity, true);
    document.removeEventListener('mousemove', onActivity, true);
    document.removeEventListener('touchstart', onActivity, true);
    document.removeEventListener('visibilitychange', syncVideo);
    bodyClassObserver.disconnect();
  }

  function start() {
    if (!stopped) {
      scheduleIdle();
      return;
    }
    stopped = false;
    attachListeners();
    scheduleIdle();
  }

  function stop() {
    stopped = true;
    clearIdleTimer();
    hide();
    detachListeners();
  }

  function applyConfig() {
    if (stopped) return;
    if (!cfg().enabled) {
      clearIdleTimer();
      if (active) hide();
      return;
    }
    if (active) {
      paintClock();
      // Settings changed under the saver: reload so a new source (e.g. aerial)
      // takes over rather than leaving the old content up.
      beginContent();
    } else {
      scheduleIdle();
    }
  }

  return {
    start: start,
    stop: stop,
    resetIdle: resetIdle,
    isActive: function () { return active; },
    applyConfig: applyConfig,
    /**
     * Force-show (settings Preview / SSH flag / launch params).
     * Ignores enabled toggle and isBlocked so demos always appear.
     */
    preview: function () {
      if (stopped) start();
      // Hide any half-state then force show.
      if (active) {
        active = false;
        slideGen += 1;
        teardownVideo();
        clearSlideTimer();
        clearClockTimer();
      }
      show({force: true});
    },
    hide: hide
  };
}
