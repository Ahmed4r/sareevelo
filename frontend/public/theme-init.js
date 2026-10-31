// Apply the saved preference before Angular or the first paint; light is the default.
(function () {
  var theme = 'light';
  try { if (localStorage.getItem('sareevelo-theme') === 'dark') theme = 'dark'; } catch (_) {}
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f4f3ef' : '#080808';
})();
