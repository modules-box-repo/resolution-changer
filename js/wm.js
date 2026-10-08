// Handles wm test/apply
(function () {
  let countdownInterval = null;
  let canSave = false;
  let testedAt = 0;

  function setCanSave(v) {
    canSave = v;
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.disabled = !v;
  }

  async function test(width, height, dpi, lockAspect, autoDpi) {
    const status = document.getElementById('testStatus');
    const testBtn = document.getElementById('testBtn');
    if (status) {
      status.classList.remove('error');
      status.textContent = 'Testing (10s)...';
    }
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.classList.add('btn-active-countdown');
      testBtn.textContent = 'Testing (10s)...';
    }
    try {
      const res = await fetch('/api/wm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width, height, dpi, lockAspect, autoDpi }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const err = data.error || 'Failed to test resolution';
        if (status) {
          status.classList.add('error');
          status.textContent = err;
        }
        if (testBtn) {
          testBtn.disabled = false;
          testBtn.classList.remove('btn-active-countdown');
          testBtn.textContent = 'Test';
        }
        setCanSave(false);
        return;
      }
    } catch (e) {
      if (status) {
        status.classList.add('error');
        status.textContent = 'Network or server error';
      }
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.classList.remove('btn-active-countdown');
        testBtn.textContent = 'Test';
      }
      setCanSave(false);
      return;
    }

    testedAt = Date.now();
    if (countdownInterval) clearInterval(countdownInterval);

    let remaining = 10;
    countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        if (status) status.textContent = `Testing (${remaining}s)...`;
        if (testBtn) testBtn.textContent = `Testing (${remaining}s)...`;
      } else {
        clearInterval(countdownInterval);
        countdownInterval = null;
        if (status) {
          status.classList.remove('error');
          status.textContent = 'Test completed (restored)';
        }
        if (testBtn) {
          testBtn.disabled = false;
          testBtn.classList.remove('btn-active-countdown');
          testBtn.textContent = 'Test';
        }
        setCanSave(true);
      }
    }, 1000);
  }

  async function apply(width, height, dpi) {
    try {
      const res = await fetch('/api/wm/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width, height, dpi }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.error || 'Failed to apply resolution');
        return false;
      }
      return true;
    } catch (e) {
      showError('Network or server error');
      return false;
    }
  }

  window.WM = { test, apply, canSave: () => canSave, setCanSave, testedAt };
})();
