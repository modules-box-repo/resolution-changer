// Server for Resolution Changer
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const DATA_DIR = __dirname;
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function getWmDisplayInfo() {
  let sizeOut = '';
  let densityOut = '';
  try {
    sizeOut = execSync('/system/bin/wm size', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`[cmd] exec: /system/bin/wm size\n[cmd] result:\n${sizeOut.trim()}`);
  } catch (e) {
    try {
      sizeOut = execSync('wm size', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[cmd] exec: wm size\n[cmd] result:\n${sizeOut.trim()}`);
    } catch (e2) {
      const err = (e.stderr ? e.stderr.toString() : e.message).trim();
      console.log(`[cmd] exec wm size failed: ${err}`);
    }
  }
  try {
    densityOut = execSync('/system/bin/wm density', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`[cmd] exec: /system/bin/wm density\n[cmd] result:\n${densityOut.trim()}`);
  } catch (e) {
    try {
      densityOut = execSync('wm density', { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[cmd] exec: wm density\n[cmd] result:\n${densityOut.trim()}`);
    } catch (e2) {
      const err = (e.stderr ? e.stderr.toString() : e.message).trim();
      console.log(`[cmd] exec wm density failed: ${err}`);
    }
  }

  const physSizeMatch = sizeOut.match(/Physical size:\s*(\d+)x(\d+)/i);
  const overSizeMatch = sizeOut.match(/Override size:\s*(\d+)x(\d+)/i);
  const physDensityMatch = densityOut.match(/Physical density:\s*(\d+)/i);
  const overDensityMatch = densityOut.match(/Override density:\s*(\d+)/i);

  const physical = {
    width: physSizeMatch ? parseInt(physSizeMatch[1], 10) : 1440,
    height: physSizeMatch ? parseInt(physSizeMatch[2], 10) : 3168,
    dpi: physDensityMatch ? parseInt(physDensityMatch[1], 10) : 640,
  };

  const override = {
    width: overSizeMatch ? parseInt(overSizeMatch[1], 10) : null,
    height: overSizeMatch ? parseInt(overSizeMatch[2], 10) : null,
    dpi: overDensityMatch ? parseInt(overDensityMatch[1], 10) : null,
  };

  const current = {
    width: override.width || physical.width,
    height: override.height || physical.height,
    dpi: override.dpi || physical.dpi,
  };

  return { physical, override, current };
}

function getDefaultProfiles() {
  const { physical, override, current } = getWmDisplayInfo();
  const ratio = physical.height / physical.width;

  const isPhysicalCurrent = (current.width === physical.width && current.height === physical.height && current.dpi === physical.dpi);

  const profiles = [
    {
      id: 'default',
      name: isPhysicalCurrent ? 'Default (Physical - Active)' : 'Default (Physical)',
      width: physical.width,
      height: physical.height,
      dpi: physical.dpi,
      lockAspect: true,
      autoDpi: false,
      fixed: true,
      isPhysical: true,
      isCurrent: isPhysicalCurrent,
    },
  ];

  const standardWidths = [
    { name: 'QHD+', width: 1440 },
    { name: 'FHD+', width: 1080 },
    { name: 'HD+', width: 720 },
    { name: 'qHD+', width: 540 },
  ];

  for (const tier of standardWidths) {
    if (tier.width >= physical.width) continue;
    const h = Math.round(tier.width * ratio);
    const d = Math.round(physical.dpi * (tier.width / physical.width));
    const isTierCurrent = (current.width === tier.width && current.height === h);
    const tierName = isTierCurrent ? `${tier.name} (Current)` : tier.name;

    profiles.push({
      id: tier.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name: tierName,
      width: tier.width,
      height: h,
      dpi: d,
      lockAspect: true,
      autoDpi: false,
      fixed: true,
      isCurrent: isTierCurrent,
    });
  }

  const matchesAny = profiles.some(p => p.width === current.width && p.height === current.height);
  if (!matchesAny && override.width && override.height) {
    profiles.splice(1, 0, {
      id: 'current-override',
      name: 'Current (Override)',
      width: current.width,
      height: current.height,
      dpi: current.dpi,
      lockAspect: true,
      autoDpi: false,
      fixed: true,
      isCurrent: true,
    });
  }

  return profiles;
}

function loadProfiles() {
  try {
    const defaults = getDefaultProfiles();
    if (fs.existsSync(PROFILES_FILE)) {
      const data = fs.readFileSync(PROFILES_FILE, 'utf8');
      const loaded = JSON.parse(data) || [];
      const fixedIds = new Set(defaults.map(d => d.id));
      const userProfiles = loaded.filter(p => !fixedIds.has(p.id) && !p.fixed);
      return defaults.concat(userProfiles);
    }
    return defaults;
  } catch (e) {
    return getDefaultProfiles();
  }
}

function saveProfiles(profiles) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (e) {}
}

function applyResolution(width, height, dpi) {
  const { physical } = getWmDisplayInfo();
  const isReset = (width === physical.width && height === physical.height);
  let cmd = '';
  if (isReset) {
    cmd = '/system/bin/wm size reset && /system/bin/wm density reset';
  } else {
    cmd = `/system/bin/wm size ${width}x${height}`;
    if (dpi) {
      cmd += ` && /system/bin/wm density ${dpi}`;
    }
  }

  console.log(`[wm] requested resolution: ${width}x${height}${dpi ? ' @ ' + dpi + ' dpi' : ''}`);
  console.log(`[cmd] exec: ${cmd}`);

  const runners = [
    `rish -c "${cmd}"`,
    `su -c "${cmd}"`,
    cmd,
  ];

  let lastError = '';
  for (const runner of runners) {
    try {
      const out = execSync(runner, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[cmd] runner succeeded: ${runner}`);
      if (out && out.trim()) {
        console.log(`[cmd] output:\n${out.trim()}`);
      }
      return { ok: true, applied: true, cmd, out };
    } catch (e) {
      const err = (e.stderr ? e.stderr.toString() : e.message).trim();
      lastError = err;
      console.log(`[cmd] runner failed (${runner}): ${err}`);
    }
  }

  console.log(`[cmd] execution failed: ${lastError || 'Permission denied'}`);
  return { ok: false, applied: false, error: 'Permission denied: Requires Shizuku or root (WRITE_SECURE_SETTINGS)', details: lastError, cmd };
}

function sendJson(res, status, data) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) {
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!body) return callback(null, {});
    try {
      callback(null, JSON.parse(body));
    } catch (e) {
      callback(e, null);
    }
  });
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname;
  let baseDir = path.join(__dirname, 'public');

  if (pathname.startsWith('/css/')) {
    baseDir = path.join(__dirname, 'css');
    relativePath = pathname.slice(4);
  } else if (pathname.startsWith('/js/')) {
    baseDir = path.join(__dirname, 'js');
    relativePath = pathname.slice(3);
  } else if (pathname === '/' || pathname === '') {
    relativePath = '/index.html';
  }

  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(baseDir, safePath);

  if (!fullPath.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(fullPath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Length': stats.size,
      });
      if (req.method === 'HEAD') {
        return res.end();
      }
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
      res.writeHead(404);
      return res.end();
    }

    const indexPath = path.join(__dirname, 'public', 'index.html');
    fs.stat(indexPath, (indexErr, indexStats) => {
      if (indexErr || !indexStats.isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': indexStats.size,
      });
      if (req.method === 'HEAD') {
        return res.end();
      }
      fs.createReadStream(indexPath).pipe(res);
    });
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/wm/display') {
    return sendJson(res, 200, getWmDisplayInfo());
  }

  if (req.method === 'GET' && pathname === '/api/profiles') {
    return sendJson(res, 200, loadProfiles());
  }

  if (req.method === 'POST' && pathname === '/api/profiles') {
    return parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { error: 'invalid json' });
      const profiles = loadProfiles();
      const profile = body || {};
      profile.id = Date.now().toString();
      profile.createdAt = Date.now();
      profiles.push(profile);
      saveProfiles(profiles);
      sendJson(res, 200, profile);
    });
  }

  const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (req.method === 'PUT' && profileMatch) {
    const id = decodeURIComponent(profileMatch[1]);
    return parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { error: 'invalid json' });
      const profiles = loadProfiles();
      const idx = profiles.findIndex((p) => p.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'not found' });
      profiles[idx] = { ...profiles[idx], ...body };
      saveProfiles(profiles);
      sendJson(res, 200, profiles[idx]);
    });
  }

  if (req.method === 'DELETE' && profileMatch) {
    const id = decodeURIComponent(profileMatch[1]);
    const all = loadProfiles();
    const target = all.find((p) => p.id === id);
    if (target && target.fixed) {
      return sendJson(res, 403, { error: 'fixed' });
    }
    const profiles = all.filter((p) => p.id !== id && !p.fixed);
    saveProfiles(profiles);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/wm/help') {
    const cmd = '/system/bin/wm -h';
    console.log(`[cmd] exec: ${cmd}`);
    const proc = spawn('/system/bin/wm', ['-h'], { timeout: 5000 });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('close', (code) => {
      console.log(`[cmd] ${cmd} finished with code: ${code}`);
      if (out.trim()) {
        console.log(`[cmd] stdout:\n${out.trim()}`);
      }
      if (err.trim()) {
        console.log(`[cmd] stderr:\n${err.trim()}`);
      }
      sendJson(res, 200, { code, out, err });
    });
    proc.on('error', (e) => {
      console.log(`[cmd] ${cmd} error: ${e.message}`);
      sendJson(res, 200, { code: -1, err: e.message });
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/wm/test') {
    return parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { error: 'invalid json' });
      const { width, height, dpi } = body || {};
      if (!width || !height) {
        return sendJson(res, 400, { error: 'missing width/height' });
      }
      console.log(`[wm] test mode requested for ${width}x${height}${dpi ? ' @ ' + dpi + ' dpi' : ''}`);
      const prevInfo = getWmDisplayInfo();
      const prevRes = {
        width: prevInfo.current.width,
        height: prevInfo.current.height,
        dpi: prevInfo.current.dpi,
      };
      const result = applyResolution(width, height, dpi);
      if (!result.ok) {
        return sendJson(res, 500, result);
      }
      console.log('[wm] test timer started (will restore in 10s)');
      setTimeout(() => {
        try {
          console.log(`[wm] test time expired, restoring previous resolution: ${prevRes.width}x${prevRes.height}`);
          applyResolution(prevRes.width, prevRes.height, prevRes.dpi);
        } catch (e) {}
      }, 10000);
      sendJson(res, 200, { ...result, durationMs: 10000 });
    });
  }

  if (req.method === 'POST' && pathname === '/api/wm/apply') {
    return parseBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { error: 'invalid json' });
      const { width, height, dpi } = body || {};
      if (!width || !height) {
        return sendJson(res, 400, { error: 'missing width/height' });
      }
      console.log(`[wm] apply requested for ${width}x${height}${dpi ? ' @ ' + dpi + ' dpi' : ''}`);
      const result = applyResolution(width, height, dpi);
      if (!result.ok) {
        return sendJson(res, 500, result);
      }
      sendJson(res, 200, result);
    });
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'not found' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405);
  res.end();
});

server.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
