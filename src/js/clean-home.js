/** CleanYourTV's four-card dock, ambient shelf and continuous app grid, for webOS. */
const ACCENTS = {
  netflix: '#e50914', amazon: '#0578ff', 'amazon.html': '#0578ff',
  'youtube.leanback.v4': '#df1434', 'com.apple.appletv': '#677dc7',
  'cdp-30': '#e5a00d',
  canalplus: '#7490aa', 'oqee.tv': '#e8003d',
  'com.disney.disneyplus-prod': '#057a91', 'tv.twitch.tv.starshot.lg': '#9146ff'
};

export function createCleanHome(options) {
  const grid = document.getElementById('app-grid');
  const shell = document.getElementById('app-grid-shell');
  const title = document.getElementById('clean-shelf-title');
  const ambient = document.getElementById('clean-ambient');
  const glass = document.getElementById('clean-focus');
  const panel = document.getElementById('clean-inputs-panel');
  const inputsButton = document.getElementById('clean-inputs-btn');
  const networkButton = document.getElementById('clean-network-btn');
  let frame = null;
  let lastAccent = '';

  function updateGreeting(date) {
    const hour = (date || new Date()).getHours();
    document.getElementById('clean-greeting').textContent = hour < 12
      ? 'BONJOUR' : hour < 18 ? 'BON APRÈS-MIDI' : 'BONSOIR';
  }

  function paintFocus() {
    frame = null;
    const selected = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('#app-grid .app-tile') : null;
    const hidden = document.body.classList.contains('settings-open') ||
      document.body.classList.contains('clean-inputs-open') ||
      document.body.classList.contains('app-inactive');
    const tile = selected || grid.querySelector('.app-tile.focused') || grid.querySelector('.app-tile');
    if (tile) {
      title.textContent = tile.getAttribute('aria-label') || '';
      const id = tile.dataset.launchId || tile.dataset.appId;
      let color = ACCENTS[id] || tile.dataset.accent || '#486894';
      if (!/^#[0-9a-f]{6}$/i.test(color) || color === '#ffffff' || color === '#000000') color = '#486894';
      if (color !== lastAccent) {
        const rgb = [1, 3, 5].map(function (offset) { return parseInt(color.slice(offset, offset + 2), 16); }).join(',');
        ambient.style.backgroundImage = 'radial-gradient(ellipse 73% 86% at 32% 42%,rgba(' + rgb + ',0.63) 0%,rgba(' + rgb + ',0.25) 45%,rgba(' + rgb + ',0) 80%)';
        lastAccent = color;
      }
    }
    if (!selected || hidden) { glass.hidden = true; return; }
    const rect = selected.getBoundingClientRect();
    const view = shell.getBoundingClientRect();
    if (rect.bottom <= view.top || rect.top >= view.bottom) { glass.hidden = true; return; }
    glass.hidden = false;
    glass.style.width = (rect.width + 14) + 'px';
    glass.style.height = (rect.height + 14) + 'px';
    glass.style.transform = 'translate3d(' + (rect.left - 7) + 'px,' + (rect.top - 7) + 'px,0)';
  }

  function scheduleFocus() {
    if (frame !== null) return;
    frame = requestAnimationFrame(paintFocus);
  }

  function closeInputs() {
    if (panel.hidden) return false;
    panel.hidden = true;
    document.body.classList.remove('clean-inputs-open');
    inputsButton.setAttribute('aria-expanded', 'false');
    options.focus.focusElement(inputsButton);
    return true;
  }

  inputsButton.addEventListener('click', function () {
    if (closeInputs()) return;
    panel.hidden = false;
    document.body.classList.add('clean-inputs-open');
    inputsButton.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('.focusable');
    if (first) options.focus.focusElement(first);
    scheduleFocus();
  });
  panel.addEventListener('click', function (event) {
    if (event.target.closest('.input-chip')) closeInputs();
  });
  networkButton.addEventListener('click', function () {
    closeInputs();
    options.onNetwork();
  });
  document.addEventListener('focusin', scheduleFocus);
  grid.addEventListener('transitionend', function (event) {
    if (event.propertyName === 'transform') scheduleFocus();
  });
  window.addEventListener('resize', scheduleFocus);
  window.addEventListener('focus', scheduleFocus);
  window.addEventListener('blur', scheduleFocus);
  shell.addEventListener('scroll', function () {
    document.body.classList.toggle('clean-grid-browsing', shell.scrollTop > 70);
    scheduleFocus();
  }, {passive: true});
  document.addEventListener('visibilitychange', scheduleFocus);

  function refresh() {
    const count = grid.querySelectorAll('.app-tile[data-app-id]').length;
    document.getElementById('clean-app-count').textContent = count + ' applications · ↓ pour parcourir';
    updateGreeting();
    document.body.classList.toggle('clean-grid-browsing', shell.scrollTop > 70);
    scheduleFocus();
  }
  refresh();
  return {refresh: refresh, closeInputs: closeInputs, updateGreeting: updateGreeting};
}
