// Handles theme switching
(function () {
  const html = document.documentElement;
  const saved = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', saved);
  function updateIcons(theme) {
    const moon = document.getElementById('themeIconMoon');
    const sun = document.getElementById('themeIconSun');
    if (!moon || !sun) return;
    if (theme === 'dark') {
      moon.classList.add('hidden');
      sun.classList.remove('hidden');
    } else {
      moon.classList.remove('hidden');
      sun.classList.add('hidden');
    }
  }
  updateIcons(saved);
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', current);
        localStorage.setItem('theme', current);
        updateIcons(current);
      });
    }
  });
})();
