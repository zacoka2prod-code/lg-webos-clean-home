/** Public display data exported from this home's HA clock. No HA credentials. */

const KEY = 'clean.daily-clock.v1';

export function currentDayKey(now) {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

export function paintDailyClock(el, value, now) {
  const today = currentDayKey(now || new Date());
  const current = value && value.date === today;
  const saint = current && value.saintDate === today && !/^(unknown|unavailable)$/.test(value.saint || '') ? value.saint : 'Actualisation…';
  el.querySelector('.clean-saint-name').textContent = saint;
  el.querySelector('.clean-daily-verse').textContent = current && value.verse ? '« ' + value.verse + ' »' : 'Actualisation du verset du jour…';
  el.querySelector('.clean-daily-reference').textContent = current ? value.reference + ' · ' + value.edition : '';
}

export function createDailyClock(getConfig) {
  const config = (getConfig && getConfig()) || {};
  if (!config.enabled || typeof config.endpoint !== 'string' || !/^https?:\/\//.test(config.endpoint) || /[@\s]/.test(config.endpoint)) return null;
  const endpoint = config.endpoint;
  const el = document.createElement('section');
  el.id = 'clean-daily-clock';
  el.setAttribute('aria-label', 'Fête et verset du jour');
  el.innerHTML = '<div class="clean-saint-line"><span class="clean-daily-label">Fête du jour</span><span class="clean-saint-name"></span></div><div class="clean-verse-line"><div class="clean-daily-label">Verset du jour</div><div class="clean-daily-verse"></div><div class="clean-daily-reference"></div></div>';
  document.querySelector('.top-bar').appendChild(el);
  let cached = null;
  let pending = false;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch (err) { /* optional cache */ }
  function paint() { paintDailyClock(el, cached); }
  function refresh() {
    paint();
    if (pending) return;
    pending = true;
    // Timeout prevents a disconnected HA host from holding refresh forever.
    const xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint + (endpoint.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      pending = false;
      if (xhr.status !== 200) return;
      try {
        if (xhr.responseText.length > 65536) return;
        const data = JSON.parse(xhr.responseText);
        if (!data || typeof data.verse !== 'string' || typeof data.saint !== 'string') return;
        cached = data;
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (err) { /* storage full: still paint */ }
        paint();
      } catch (err) { /* keep today's cache */ }
    };
    xhr.onerror = xhr.ontimeout = function () { pending = false; };
    xhr.send();
  }
  refresh();
  const timer = setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  return {refresh: refresh, stop: function () { clearInterval(timer); }};
}
