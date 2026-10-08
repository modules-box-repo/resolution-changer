// Handles profiles
(function () {
  const listEl = document.getElementById('profilesList');
  const emptyEl = document.getElementById('emptyState');
  const spinnerEl = document.getElementById('loadingSpinner');
  let profiles = [];
  let activeTestInterval = null;

  async function load() {
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    try {
      const res = await fetch('/api/profiles');
      profiles = await res.json();
    } catch (e) {
      profiles = [];
    }
    try {
      const dRes = await fetch('/api/wm/display');
      const d = await dRes.json();
      updateDisplayInfo(d);
    } catch (e) {}
    if (spinnerEl) spinnerEl.classList.add('hidden');
    render();
  }

  function updateDisplayInfo(d) {
    if (!d) return;
    const physEl = document.getElementById('displayPhysical');
    const currEl = document.getElementById('displayCurrent');
    const physDpiEl = document.getElementById('displayPhysicalDpi');
    const currDpiEl = document.getElementById('displayCurrentDpi');
    if (physEl && d.physical) physEl.textContent = `${d.physical.width} × ${d.physical.height}`;
    if (currEl && d.current) currEl.textContent = `${d.current.width} × ${d.current.height}`;
    if (physDpiEl && d.physical) physDpiEl.textContent = d.physical.dpi;
    if (currDpiEl && d.current) currDpiEl.textContent = d.current.dpi;
  }

  function render() {
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = '';
    if (profiles.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    profiles.forEach((p, index) => {
      const card = document.createElement('div');
      card.className = 'profile-card fade-in';
      card.style.animationDelay = `${index * 50}ms`;
      const isCur = Boolean(p.isCurrent);
      card.innerHTML = `
        <div class="profile-header">
          <span class="profile-name">${p.name}</span>
          <div class="actions">
            <button class="btn test" data-id="${p.id}" ${isCur ? 'disabled' : ''}>Test</button>
            <button class="btn primary apply" data-id="${p.id}" ${isCur ? 'disabled' : ''}>Apply</button>
            ${p.fixed ? '' : `<button class="btn delete" data-id="${p.id}">Delete</button>`}
          </div>
        </div>
        <div class="profile-meta">
          <span class="chip">${fmt(p.width)} × ${fmt(p.height)}</span>
          <span class="chip">DPI ${fmt(p.dpi)}</span>
          ${p.isCurrent ? '<span class="chip active">Current</span>' : ''}
          ${p.isPhysical && !p.isCurrent ? '<span class="chip">Physical</span>' : ''}
          ${p.autoDpi ? '<span class="chip">Auto DPI adjust</span>' : ''}
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  async function remove(id) {
    try {
      await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      profiles = profiles.filter((x) => x.id !== id);
      render();
    } catch (e) {}
  }

  async function test(id) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const btn = document.querySelector(`.test[data-id="${id}"]`);
    if (btn) {
      btn.disabled = true;
      btn.classList.add('btn-active-countdown');
      btn.textContent = 'Testing (10s)...';
      try {
        const res = await fetch('/api/wm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ width: p.width, height: p.height, dpi: p.dpi }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          btn.disabled = false;
          btn.classList.remove('btn-active-countdown');
          btn.textContent = 'Test';
          showError(data.error || 'Failed to test resolution');
          return;
        }

        let remaining = 10;
        if (activeTestInterval) clearInterval(activeTestInterval);
        activeTestInterval = setInterval(async () => {
          remaining -= 1;
          if (remaining > 0) {
            btn.textContent = `Testing (${remaining}s)...`;
          } else {
            clearInterval(activeTestInterval);
            activeTestInterval = null;
            btn.disabled = false;
            btn.classList.remove('btn-active-countdown');
            btn.textContent = 'Test';
            await load();
          }
        }, 1000);
      } catch (e) {
        btn.disabled = false;
        btn.classList.remove('btn-active-countdown');
        btn.textContent = 'Test';
        showError('Network or server error');
      }
    }
  }

  async function apply(id) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const btn = document.querySelector(`.apply[data-id="${id}"]`);
    if (btn) {
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'Applying...';
      try {
        const res = await fetch('/api/wm/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ width: p.width, height: p.height, dpi: p.dpi }),
        });
        const data = await res.json();
        btn.disabled = false;
        btn.textContent = old;
        if (!res.ok || !data.ok) {
          showError(data.error || 'Failed to apply resolution');
          return;
        }
        await load();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = old;
        showError('Network or server error');
      }
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-id]');
    if (!t) return;
    const id = t.dataset.id;
    if (t.classList.contains('delete')) remove(id);
    if (t.classList.contains('test')) test(id);
    if (t.classList.contains('apply')) apply(id);
  });

  window.Profiles = { load, add: (p) => { profiles.push(p); render(); }, getAll: () => profiles };
})();
