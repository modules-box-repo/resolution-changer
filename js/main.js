// Main logic
(function () {
  const fab = document.getElementById('fab');
  const dialog = document.getElementById('profileDialog');
  const form = document.getElementById('profileForm');
  const closeBtn = document.getElementById('dialogClose');
  const nameInput = document.getElementById('profileName');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const dpiInput = document.getElementById('dpiInput');
  const lockAspect = document.getElementById('lockAspect');
  const autoDpi = document.getElementById('autoDpi');
  const testBtn = document.getElementById('testBtn');
  const saveBtn = document.getElementById('saveBtn');
  const dialogTitle = document.getElementById('dialogTitle');
  const statusEl = document.getElementById('testStatus');

  let aspectRatio = null;
  let devicePhysical = null;

  async function fetchDevice() {
    try {
      const res = await fetch('/api/wm/display');
      const data = await res.json();
      if (data && data.physical) {
        devicePhysical = data.physical;
      }
    } catch (e) {}
  }

  function resetForm() {
    form.reset();
    dialogTitle.textContent = 'New Profile';
    if (devicePhysical) {
      aspectRatio = devicePhysical.width / devicePhysical.height;
    } else {
      aspectRatio = null;
    }
    if (lockAspect) lockAspect.checked = true;
    if (autoDpi) autoDpi.checked = true;
    if (statusEl) statusEl.textContent = '';
    WM.setCanSave(false);
  }

  function openDialog() {
    resetForm();
    if (dialog) dialog.showModal();
    nameInput?.focus();
  }

  function closeDialog() {
    if (dialog) dialog.close();
  }

  fab?.addEventListener('click', openDialog);
  closeBtn?.addEventListener('click', closeDialog);
  dialog?.addEventListener('close', resetForm);

  widthInput?.addEventListener('input', () => {
    const w = parseFloat(widthInput.value);
    if (!isNaN(w) && w > 0) {
      if (lockAspect?.checked && aspectRatio && aspectRatio > 0) {
        heightInput.value = Math.round(w / aspectRatio).toString();
      }
      if (autoDpi?.checked && devicePhysical && devicePhysical.width > 0) {
        dpiInput.value = Math.round(devicePhysical.dpi * (w / devicePhysical.width)).toString();
      }
    }
  });

  heightInput?.addEventListener('input', () => {
    const h = parseFloat(heightInput.value);
    if (!isNaN(h) && h > 0) {
      if (lockAspect?.checked && aspectRatio && aspectRatio > 0) {
        widthInput.value = Math.round(h * aspectRatio).toString();
        if (autoDpi?.checked && devicePhysical && devicePhysical.width > 0) {
          const w = parseFloat(widthInput.value);
          dpiInput.value = Math.round(devicePhysical.dpi * (w / devicePhysical.width)).toString();
        }
      }
    }
  });

  lockAspect?.addEventListener('change', () => {
    if (lockAspect.checked && widthInput.value && heightInput.value) {
      const w = parseFloat(widthInput.value);
      const h = parseFloat(heightInput.value);
      if (w > 0 && h > 0) aspectRatio = w / h;
    }
  });

  autoDpi?.addEventListener('change', () => {
    if (autoDpi.checked && devicePhysical && widthInput.value) {
      const w = parseFloat(widthInput.value);
      if (w > 0) {
        dpiInput.value = Math.round(devicePhysical.dpi * (w / devicePhysical.width)).toString();
      }
    }
  });

  testBtn?.addEventListener('click', () => {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);
    const d = parseInt(dpiInput.value, 10) || null;
    if (!w || !h) {
      if (statusEl) {
        statusEl.classList.add('error');
        statusEl.textContent = 'Width and height required';
      }
      return;
    }
    WM.test(w, h, d, lockAspect.checked, autoDpi.checked);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!WM.canSave()) return;
    const profile = {
      name: nameInput.value.trim(),
      width: parseInt(widthInput.value, 10),
      height: parseInt(heightInput.value, 10),
      dpi: dpiInput.value ? parseInt(dpiInput.value, 10) : null,
      lockAspect: lockAspect.checked,
      autoDpi: autoDpi.checked,
    };
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const saved = await res.json();
      if (window.Profiles) window.Profiles.add(saved);
      closeDialog();
    } catch (err) {}
  });

  document.addEventListener('DOMContentLoaded', () => {
    fetchDevice();
    if (window.Profiles) window.Profiles.load();
  });
})();
