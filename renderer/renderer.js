/**
 * renderer.js — Front-end logic for Sudarshan AI (Electron renderer process)
 *
 * Responsibilities:
 *  - Wait for backend (Flask) to be ready, then hide boot overlay
 *  - Handle navigation between views (scan / running / report / history)
 *  - Scan form: mode switching, authorization gate, start scan
 *  - Running view: poll /api/scan/<id>/status, animate tool rows & log
 *  - Report view: render Markdown, save/reveal report
 *  - History view: load past reports from /api/history
 */

/* ────────────────────────────────────────────────────────────────────────────
   1.  Bootstrap — resolve API base URL, then wire everything up
   ──────────────────────────────────────────────────────────────────────────── */

let API_BASE = 'http://127.0.0.1:5174';   // fallback until main confirms
let currentScanId = null;
let pollTimer = null;
let lastLogCount = 0;

// Tool display order & friendly names
const TOOL_DEFS = [
  { key: 'subfinder',  label: 'subfinder',  phase: 'recon' },
  { key: 'httpx',      label: 'httpx',      phase: 'recon' },
  { key: 'katana',     label: 'katana',     phase: 'recon' },
  { key: 'nuclei',     label: 'nuclei',     phase: 'scan'  },
  { key: 'ffuf',       label: 'ffuf',       phase: 'scan'  },
  { key: 'sqlmap',     label: 'sqlmap',     phase: 'scan'  },
  { key: 'semgrep',    label: 'semgrep',    phase: 'code'  },
  { key: 'gitleaks',   label: 'gitleaks',   phase: 'code'  },
  { key: 'pip-audit',  label: 'pip-audit',  phase: 'code'  },
  { key: 'npm-audit',  label: 'npm audit',  phase: 'code'  },
  { key: 'ollama',     label: 'AI analysis',phase: 'ai'    },
];

async function bootstrap() {
  // Ask main process for the real API base (it knows the port)
  if (window.sudarshan) {
    try {
      API_BASE = await window.sudarshan.getApiBase();
    } catch (_) { /* use fallback */ }

    window.sudarshan.onBackendReady(({ apiBase }) => {
      if (apiBase) API_BASE = apiBase;
      markBackendReady();
    });

    window.sudarshan.onBackendError(({ message }) => {
      showBackendError(message);
    });
  } else {
    // Running directly in a browser for dev preview — skip overlay after a beat
    setTimeout(markBackendReady, 800);
  }

  // Poll health ourselves too (catches cases where event already fired)
  pollBackendHealth();
  wireUI();
}

/* ────────────────────────────────────────────────────────────────────────────
   2.  Boot overlay helpers
   ──────────────────────────────────────────────────────────────────────────── */

function pollBackendHealth() {
  let tries = 0;
  const MAX = 60;
  const tick = () => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.ok ? markBackendReady() : retry())
      .catch(() => retry());
  };
  const retry = () => {
    tries++;
    if (tries >= MAX) {
      showBackendError('Backend did not respond after 30 s. Check that Python and requirements are installed.');
      return;
    }
    const msg = document.getElementById('boot-msg');
    if (msg) msg.textContent = `Starting backend… (${tries})`;
    setTimeout(tick, 500);
  };
  tick();
}

let _backendReady = false;
function markBackendReady() {
  if (_backendReady) return;
  _backendReady = true;
  const overlay = document.getElementById('boot-overlay');
  const appEl   = document.getElementById('app');
  if (overlay) { overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s'; setTimeout(() => overlay.remove(), 350); }
  if (appEl)   appEl.style.display = 'flex';
  setPillState('ready', 'connected');
  loadHistory();          // pre-load history in background
}

function showBackendError(msg) {
  const overlay = document.getElementById('boot-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div class="boot-logo" style="color:var(--crit)">● sudarshan/ai</div>
      <div class="boot-sub" style="color:var(--crit);max-width:360px;text-align:center">${escHtml(msg)}</div>
      <div class="boot-sub" style="margin-top:8px">Make sure Python &amp; requirements are installed, then relaunch.</div>`;
  }
  setPillState('error', 'error');
}

function setPillState(state, label) {
  const pill = document.getElementById('bePill');
  const lbl  = document.getElementById('beLabel');
  if (!pill || !lbl) return;
  pill.className = `be-pill ${state}`;
  lbl.textContent = label;
}

/* ────────────────────────────────────────────────────────────────────────────
   3.  Navigation
   ──────────────────────────────────────────────────────────────────────────── */

const VIEW_META = {
  scan:    ['New scan',  'Configure and launch a scan against an authorized target'],
  run:     ['Running',   'Scan in progress…'],
  report:  ['Report',    'Latest scan report'],
  history: ['History',   'Past scans in this workspace'],
};

function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  const [title, sub] = VIEW_META[viewName] || [viewName, ''];
  const titleEl = document.getElementById('topTitle');
  const subEl   = document.getElementById('topSub');
  if (titleEl) titleEl.textContent = title;
  if (subEl)   subEl.textContent   = sub;
}

/* ────────────────────────────────────────────────────────────────────────────
   4.  Wire all UI interactions
   ──────────────────────────────────────────────────────────────────────────── */

function wireUI() {
  // ── Navigation ──────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      switchView(el.dataset.view);
      if (el.dataset.view === 'history') loadHistory();
    });
  });

  // ── Scan mode buttons ────────────────────────────────────────────────────
  document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      applyMode(btn.dataset.mode);
    });
  });

  // ── sqlmap toggle ────────────────────────────────────────────────────────
  const sqlSwitch = document.getElementById('sqlmapSwitch');
  if (sqlSwitch) {
    sqlSwitch.addEventListener('click', () => {
      const isOn = sqlSwitch.classList.contains('on');
      if (!isOn) {
        if (confirm('sqlmap sends a large volume of requests and is intrusive.\nConfirm you are authorized to run it against this target.')) {
          sqlSwitch.classList.add('on');
        }
      } else {
        sqlSwitch.classList.remove('on');
      }
    });
  }

  // ── Authorization checkbox → enable Start ────────────────────────────────
  const authCheck = document.getElementById('authCheck');
  const startBtn  = document.getElementById('startBtn');
  const targetInput = document.getElementById('targetInput');
  if (authCheck && startBtn) {
    const updateStart = () => {
      const hasAuth   = authCheck.checked;
      const hasTarget = targetInput && targetInput.value.trim().length > 0;
      startBtn.disabled = !(hasAuth && hasTarget);
    };
    authCheck.addEventListener('change', updateStart);
    if (targetInput) targetInput.addEventListener('input', updateStart);
  }

  // ── Browse buttons (Electron only) ──────────────────────────────────────
  const browseBtn     = document.getElementById('browseBtn');
  const wordlistBrowse = document.getElementById('wordlistBrowse');

  if (browseBtn && window.sudarshan) {
    browseBtn.addEventListener('click', async () => {
      const p = await window.sudarshan.pickFolder();
      if (p && targetInput) targetInput.value = p;
    });
  }
  if (wordlistBrowse && window.sudarshan) {
    wordlistBrowse.addEventListener('click', async () => {
      const p = await window.sudarshan.pickFile();
      const el = document.getElementById('wordlistInput');
      if (p && el) el.value = p;
    });
  }

  // ── Start scan ───────────────────────────────────────────────────────────
  if (startBtn) {
    startBtn.addEventListener('click', startScan);
  }

  // ── Cancel button ────────────────────────────────────────────────────────
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      stopPolling();
      setPillState('ready', 'connected');
      toast('Scan polling stopped. The backend process may still be running.');
    });
  }

  // ── Report action buttons (handled via postMessage from iframe) ─────────
  // Buttons are now inside report-viewer.html; messages arrive in the
  // window.addEventListener('message', ...) handler defined in showReport()
}

/* ────────────────────────────────────────────────────────────────────────────
   5.  Scan mode switching
   ──────────────────────────────────────────────────────────────────────────── */

function applyMode(mode) {
  const labelEl   = document.getElementById('targetLabel');
  const inputEl   = document.getElementById('targetInput');
  const browseBtn = document.getElementById('browseBtn');
  const advPanel  = document.getElementById('advPanel');

  const config = {
    url:       { label: 'Target URL',     placeholder: 'https://your-authorized-target.com', browse: false, adv: true  },
    localhost: { label: 'Local address',  placeholder: 'http://localhost:3000',              browse: false, adv: true  },
    codebase:  { label: 'Project path',   placeholder: '/path/to/project',                   browse: true,  adv: false },
  };
  const c = config[mode] || config.url;
  if (labelEl)   labelEl.textContent       = c.label;
  if (inputEl)   inputEl.placeholder       = c.placeholder;
  if (browseBtn) browseBtn.style.display   = c.browse ? 'inline-flex' : 'none';
  if (advPanel)  advPanel.style.display    = c.adv    ? ''            : 'none';
}

/* ────────────────────────────────────────────────────────────────────────────
   6.  Start scan
   ──────────────────────────────────────────────────────────────────────────── */

async function startScan() {
  const target     = document.getElementById('targetInput')?.value.trim();
  const mode       = document.querySelector('.mode-btn.sel')?.dataset.mode || 'url';
  const model      = document.getElementById('modelSelect')?.value || '';
  const wordlist   = document.getElementById('wordlistInput')?.value.trim() || '';
  const nucleiSev  = document.getElementById('nucleiSev')?.value.trim()     || 'low,medium,high,critical';
  const ollamaHost = document.getElementById('ollamaHost')?.value.trim()    || 'http://localhost:11434';
  const sqlmap     = document.getElementById('sqlmapSwitch')?.classList.contains('on') || false;

  const errEl = document.getElementById('startError');
  if (!target) {
    if (errEl) { errEl.textContent = 'Enter a target first.'; errEl.style.display = 'inline'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  // Reset running view
  resetRunningView(target, mode);
  switchView('run');
  document.getElementById('run-badge')?.style && (document.getElementById('run-badge').style.display = 'inline-block');

  try {
    const res = await fetch(`${API_BASE}/api/scan/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, mode, model, wordlist, ollama_host: ollamaHost, enable_sqlmap: sqlmap, nuclei_severity: nucleiSev }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    currentScanId = data.scan_id;
    startPolling(currentScanId);
  } catch (err) {
    appendLog({ level: 'error', msg: `Failed to start scan: ${err.message}` });
    document.getElementById('cancelBtn').disabled = false;
    toast(`Error: ${err.message}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   7.  Running view — reset & tool list
   ──────────────────────────────────────────────────────────────────────────── */

function resetRunningView(target, mode) {
  lastLogCount = 0;

  // Target label
  const runTarget = document.getElementById('runTarget');
  if (runTarget) runTarget.textContent = target;

  // Status badge
  const badge = document.getElementById('runStatusBadge');
  if (badge) { badge.textContent = 'starting'; badge.style.color = 'var(--med)'; }

  // Progress
  setProgress(0);

  // Log box
  const logBox = document.getElementById('logBox');
  if (logBox) logBox.innerHTML = '<div class="ll info">Starting scan…</div>';

  // Cancel button
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.disabled = false;

  // Build tool list based on mode
  const toolList = document.getElementById('toolList');
  if (!toolList) return;
  toolList.innerHTML = '';

  const visibleTools = mode === 'codebase'
    ? TOOL_DEFS.filter(t => t.phase === 'code' || t.phase === 'ai')
    : TOOL_DEFS.filter(t => t.phase !== 'code');

  visibleTools.forEach(t => {
    const row = document.createElement('div');
    row.className = 'tool-row';
    row.id = `tool-${t.key}`;
    row.innerHTML = `
      <div class="state pending" id="state-${t.key}"></div>
      <div class="t-name">${escHtml(t.label)}</div>
      <div class="t-status" id="status-${t.key}">queued</div>`;
    toolList.appendChild(row);
  });
}

function updateToolState(toolKey, state, statusText) {
  const stateEl  = document.getElementById(`state-${toolKey}`);
  const statusEl = document.getElementById(`status-${toolKey}`);
  if (stateEl)  stateEl.className  = `state ${state}`;
  if (statusEl) statusEl.textContent = statusText;
}

/* ────────────────────────────────────────────────────────────────────────────
   8.  Polling
   ──────────────────────────────────────────────────────────────────────────── */

function startPolling(scanId) {
  stopPolling();
  pollTimer = setInterval(() => pollStatus(scanId), 800);
  pollStatus(scanId);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollStatus(scanId) {
  try {
    const res  = await fetch(`${API_BASE}/api/scan/${scanId}/status`);
    if (!res.ok) return;
    const data = await res.json();

    renderStatusUpdate(data);

    if (data.status === 'done') {
      stopPolling();
      onScanDone(scanId, data);
    } else if (data.status === 'error') {
      stopPolling();
      onScanError(data);
    }
  } catch (_) { /* network blip — keep polling */ }
}

function renderStatusUpdate(data) {
  const { logs, status, target } = data;
  const badge = document.getElementById('runStatusBadge');
  if (badge) {
    badge.textContent = status;
    badge.style.color = status === 'running' ? 'var(--high)' : status === 'done' ? 'var(--low)' : 'var(--crit)';
  }

  // Append only new log lines
  const newLines = logs.slice(lastLogCount);
  lastLogCount = logs.length;
  newLines.forEach(entry => appendLog(entry));

  // Derive tool states from log messages
  inferToolStates(logs);

  // Progress heuristic from phase + tool completion
  const pct = estimateProgress(logs);
  setProgress(pct);

  // Update "Running" topbar subtitle
  const subEl = document.getElementById('topSub');
  if (subEl && document.querySelector('.nav-item[data-view="run"]')?.classList.contains('active')) {
    subEl.textContent = `${target} — ${status}`;
  }
}

/* Infer which tools are done/running based on log messages */
function inferToolStates(logs) {
  // Build a compact lookup: tool key → last relevant state
  const state = {};
  logs.forEach(entry => {
    const msg = (entry.msg || '').toLowerCase();
    TOOL_DEFS.forEach(t => {
      const key = t.key.replace('-', '');          // pip-audit → pipaudit
      const lab = t.label.replace(' ', '').toLowerCase();
      const match = msg.includes(t.key) || msg.includes(lab);
      if (!match) return;
      if (entry.level === 'done') state[t.key] = 'done';
      else if (entry.level === 'tool' && msg.includes('running')) state[t.key] = 'running';
      else if (entry.level === 'tool' && msg.includes('analys')) state['ollama'] = 'running';
    });
  });

  // Also catch "analysis done" lines
  logs.forEach(e => {
    const msg = (e.msg || '').toLowerCase();
    if (e.level === 'done' && msg.includes('analysis done')) {
      // Find which tool
      TOOL_DEFS.forEach(t => {
        if (msg.includes(t.key)) state[t.key] = 'done';
      });
    }
    if (e.level === 'done' && msg.includes('executive summary ready')) {
      state['ollama'] = 'done';
    }
  });

  Object.entries(state).forEach(([key, st]) => {
    const statusText = st === 'running' ? 'running…'
                     : st === 'done'    ? 'done'
                     : st === 'error'   ? 'error'
                     : 'queued';
    updateToolState(key, st, statusText);
  });
}

function estimateProgress(logs) {
  if (!logs.length) return 0;
  const phases = ['phase 1', 'phase 2', 'phase 3', 'phase 4'];
  let maxPhase = 0;
  let doneCount = 0;
  logs.forEach(e => {
    const msg = (e.msg || '').toLowerCase();
    phases.forEach((p, i) => { if (msg.includes(p)) maxPhase = Math.max(maxPhase, i + 1); });
    if (e.level === 'done') doneCount++;
  });
  const phaseBase = (maxPhase / 4) * 80;
  const doneBonus = Math.min(doneCount * 3, 20);
  return Math.min(Math.round(phaseBase + doneBonus), 98);
}

function setProgress(pct) {
  const bar   = document.getElementById('progressBar');
  const label = document.getElementById('progressLabel');
  if (bar)   bar.style.width   = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
}

/* ────────────────────────────────────────────────────────────────────────────
   9.  Log rendering
   ──────────────────────────────────────────────────────────────────────────── */

function appendLog(entry) {
  const logBox = document.getElementById('logBox');
  if (!logBox) return;
  const line = document.createElement('div');
  const level = entry.level || 'info';
  line.className = `ll ${level}`;
  const ts = entry.ts ? `<span style="color:var(--text-faint);margin-right:8px">${escHtml(entry.ts)}</span>` : '';
  line.innerHTML = `${ts}${escHtml(entry.msg || '')}`;
  logBox.appendChild(line);
  // Auto-scroll
  logBox.scrollTop = logBox.scrollHeight;
}

/* ────────────────────────────────────────────────────────────────────────────
   10. Scan completion
   ──────────────────────────────────────────────────────────────────────────── */

async function onScanDone(scanId, statusData) {
  setProgress(100);
  const badge = document.getElementById('runStatusBadge');
  if (badge) { badge.textContent = 'done'; badge.style.color = 'var(--low)'; }
  document.getElementById('cancelBtn').disabled = true;
  document.getElementById('run-badge').style.display = 'none';

  // Mark all known tools as done
  TOOL_DEFS.forEach(t => updateToolState(t.key, 'done', 'done'));

  appendLog({ level: 'done', msg: '✓ Scan complete — fetching report…' });
  toast('Scan complete! Loading report…');

  try {
    const res  = await fetch(`${API_BASE}/api/scan/${scanId}/report`);
    const data = await res.json();
    if (data.report_md) {
      showReport(data.report_md, data.report_path);
      setTimeout(() => switchView('report'), 600);
    }
  } catch (err) {
    toast(`Could not load report: ${err.message}`);
  }
}

function onScanError(data) {
  setProgress(0);
  const badge = document.getElementById('runStatusBadge');
  if (badge) { badge.textContent = 'error'; badge.style.color = 'var(--crit)'; }
  document.getElementById('cancelBtn').disabled = true;
  document.getElementById('run-badge').style.display = 'none';
  appendLog({ level: 'error', msg: '✗ Scan failed — check log above for details.' });
  toast('Scan encountered an error.');
}

/* ────────────────────────────────────────────────────────────────────────────
   11. Report view — renders via report-viewer.html iframe
   ──────────────────────────────────────────────────────────────────────────── */

let _currentReportPath = null;
let _currentReportMd   = null;

function showReport(md, filePath) {
  _currentReportMd   = md;
  _currentReportPath = filePath || null;

  const placeholder = document.getElementById('report-placeholder');
  const frame       = document.getElementById('reportFrame');

  if (placeholder) placeholder.style.display = 'none';
  if (frame) {
    frame.style.display = 'flex';
    // Wait for iframe to load, then send data via postMessage
    const send = () => {
      try {
        frame.contentWindow.postMessage({ type: 'render-report', md, filePath: filePath || '' }, '*');
      } catch (e) {
        console.error('postMessage to report frame failed:', e);
      }
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
      send();
    } else {
      frame.onload = send;
    }
  }
}

// Listen for messages back from the iframe (button clicks)
window.addEventListener('message', (e) => {
  if (!e.data || !e.data.type) return;
  if (e.data.type === 'save-report')   saveReport();
  if (e.data.type === 'reveal-report') revealReport();
  if (e.data.type === 'new-scan')      switchView('scan');
});

async function saveReport() {
  if (!_currentReportMd) return;
  const fname = _currentReportPath
    ? _currentReportPath.split(/[/\\]/).pop()
    : `sudarshan_report_${Date.now()}.md`;

  if (window.sudarshan) {
    const result = await window.sudarshan.saveReport({ defaultName: fname, content: _currentReportMd });
    if (result.ok) toast(`Report saved to ${result.path}`);
    else if (result.error) toast(`Save failed: ${result.error}`);
  } else {
    const blob = new Blob([_currentReportMd], { type: 'text/markdown' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

async function revealReport() {
  if (!_currentReportPath) { toast('Report path not available.'); return; }
  if (window.sudarshan) {
    await window.sudarshan.revealInExplorer(_currentReportPath);
  } else {
    toast(`Report is at: ${_currentReportPath}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   12. History view
   ──────────────────────────────────────────────────────────────────────────── */

async function loadHistory() {
  const histList = document.getElementById('histList');
  if (!histList) return;

  try {
    const res  = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      histList.innerHTML = '<div class="empty">No scans yet — run your first scan to see history here.</div>';
      return;
    }

    histList.innerHTML = '';
    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'hist-row';

      // Parse target & date from filename: sudarshan_report_<target>_YYYYMMDD_HHMMSS.md
      const fname   = item.filename || '';
      const parts   = fname.replace('sudarshan_report_', '').replace('.md', '').split('_');
      const dateStr = parts.length >= 3 ? `${parts[parts.length - 2]} ${parts[parts.length - 1].replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3')}` : '';
      const target  = parts.slice(0, parts.length - 2).join('_') || fname;

      const mtime = item.mtime ? new Date(item.mtime).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

      row.innerHTML = `
        <div class="h-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
        </div>
        <div class="h-target" title="${escHtml(fname)}">${escHtml(target)}</div>
        <div class="h-meta">${escHtml(item.mode || '')}</div>
        <div class="h-date">${escHtml(mtime)}</div>`;

      row.addEventListener('click', () => openHistoryItem(item.filename));
      histList.appendChild(row);
    });
  } catch (_) {
    histList.innerHTML = '<div class="empty">Could not load history — is the backend running?</div>';
  }
}

async function openHistoryItem(filename) {
  try {
    const res  = await fetch(`${API_BASE}/api/history/${encodeURIComponent(filename)}`);
    const data = await res.json();
    showReport(data.content, null);
    switchView('report');
  } catch (err) {
    toast(`Could not load report: ${err.message}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   13. Markdown → HTML via marked (loaded as a script tag in index.html)
       Falls back to a lightweight built-in renderer if marked is unavailable.
   ──────────────────────────────────────────────────────────────────────────── */

function renderMarkdown(md) {
  if (!md) return '';

  // marked is loaded as a <script> tag (marked.min.js) and exposes window.marked
  if (typeof window.marked !== 'undefined') {
    try {
      // marked v4+ uses marked.parse(); v2/v3 uses marked() directly
      const parseFn = window.marked.parse || window.marked;
      const html = parseFn(md, { gfm: true, breaks: false });
      // Make all links open in a new tab
      return html.replace(/<a href=/g, '<a target="_blank" rel="noopener" href=');
    } catch (e) {
      console.warn('marked failed, using fallback renderer:', e);
    }
  }

  // ── Lightweight fallback renderer ──────────────────────────────────────
  return md
    // fenced code blocks (before HTML escaping to preserve content)
    .replace(/```[\w]*\n([\s\S]*?)```/gm, (_, code) =>
      `<pre><code>${code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
    // HTML-escape remaining text
    .replace(/(?<!<[^>]*)&(?![a-z#\d]+;)/g, '&amp;')
    // headings
    .replace(/^#{4}\s+(.+)$/gm,  '<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm,  '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm,  '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm,  '<h1>$1</h1>')
    // bold & italic
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,     '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g,         '<code>$1</code>')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // hr
    .replace(/^---+$/gm,           '<hr>')
    // line breaks between paragraphs
    .replace(/\n{2,}/g,            '</p><p>')
    .replace(/^(.)/,               '<p>$1') + '</p>';
}

/* ────────────────────────────────────────────────────────────────────────────
   14. Toast notification
   ──────────────────────────────────────────────────────────────────────────── */

let _toastTimer = null;
function toast(msg, durationMs = 3500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), durationMs);
}

/* ────────────────────────────────────────────────────────────────────────────
   15. Utility
   ──────────────────────────────────────────────────────────────────────────── */

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ────────────────────────────────────────────────────────────────────────────
   16. Entry point
   ──────────────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', bootstrap);
