// Runs before first paint: sets the theme and starts the opening animation so nothing flashes.
(function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem('fluid-gallery-prefs-v1') || '{}') || {}; } catch (e) { p = {}; }
  var root = document.documentElement;
  var theme = p.theme === 'light' || p.theme === 'dark' ? p.theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = theme;
  var reduce = p.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) root.classList.add('reduce');
  var seen = false;
  try { seen = sessionStorage.getItem('fg-intro') === '1'; sessionStorage.setItem('fg-intro', '1'); } catch (e) { seen = true; }
  if (!seen) {
    root.classList.add('intro');
    setTimeout(function () { root.classList.remove('intro'); }, 900);
  }
})();
