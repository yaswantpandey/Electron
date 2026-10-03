/**
 * app.js — Sudarshan AI  |  Web GUI v2
 * Works in any modern browser. No build step, no Electron required.
 */

'use strict';

const API_BASE = window.location.origin;

/* ── State ─────────────────────────────────────────────────────────────── */
let currentScanId  = null;
let pollTimer      = null;
let lastLogCount   = 0;
let toolStartTimes = {};

/* ── Tool definitions ───────────────────────────────────────────────────── */
const TOOL_DEFS = [
  { key: 'subfinder', label: 'subfinder',  phase: 'recon' },
  { key: 'httpx',     label: 'httpx',      phase: 'recon' },
  { key: 'katana',    label: 'katana',     phase: 'recon' },
  { key: 'nuclei',    label: 'nuclei',     phase: 'scan'  },
  { key: 'ffuf',      label: 'ffuf',       phase: 'scan'  },
  { key: 'sqlmap',    label: 'sqlmap',     phase: 'scan'  },
  { key: 'semgrep',   label: 'semgrep',    phase: 'code'  },
  { key: 'gitleaks',  label: 'gitleaks',   phase: 'code'  },
  { key: 'pip-audit', label: 'pip-audit',  phase: 'code'  },
  { key: 'npm-audit', label: 'npm audit',  phase: 'code'  },
  { key: 'ollama',    label: 'AI analysis',phase: 'ai'    },
];

const VIEW_META = {
  scan:    ['New Scan',      'Configure and launch a scan against an authorized target'],
  run:     ['Running',       'Live scan in progress'],
  report:  ['Report',        'Latest scan report'],
  history: ['History',       'Past scans stored in reports/'],
  owasp:   ['OWASP Top 10',  'Tool coverage map for OWASP Top 10 (2021)'],
};

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => { pollHealth(); wireUI(); });

let _ready = false;
async function pollHealth() {
  let tries = 0;
  const MAX = 60;
  const msgEl = document.getElementById('boot-msg');

  const tick = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
      if (r.ok) { showApp(); return; }
    } catch (_) {}
    if (++tries >= MAX) {
      bootError('Backend did not respond after 30 s.\nRun: python api_server.py');
      return;
    }
    if (msgEl) msgEl.textContent = `Connecting to backend… (${tries})`;
    setTimeout(tick, 500);
  };
  tick();
}

function showApp() {
  if (_ready) return;
  _ready = true;
  const boot = document.getElementById('boot');
  const app  = document.getElementById('app');
  if (boot) { boot.style.opacity = '0'; boot.style.transition = 'opacity .3s'; setTimeout(() => boot.remove(), 350); }
  if (app)  app.style.display = 'flex';
  setPill('online', 'connected');
  loadHistory();
}

function bootError(msg) {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.innerHTML = `
      <div class="boot-logo" style="color:var(--crit)">
        <div class="boot-dot" style="background:var(--crit);box-shadow:0 0 10px var(--crit)"></div>
        <span class="boot-name">sudarshan</span><span class="boot-slash">/ai</span>
      </div>
      <div style="font-family:var(--mono);font-size:12px;color:var(--crit);text-align:center;max-width:360px;white-space:pre-wrap">${esc(msg)}</div>
      <div class="boot-cmd">Run: <code>python api_server.py</code></div>`;
  }
  setPill('offline', 'offline');
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI WIRING
═══════════════════════════════════════════════════════════════════════════ */
function wireUI() {
  // nav
  document.querySelectorAll('.nav-item[data-view]').forEach(el =>
    el.addEventListener('click', () => {
      switchView(el.dataset.view);
      if (el.dataset.view === 'history') loadHistory();
    })
  );

  // mode cards
  document.querySelectorAll('.mode-card[data-mode]').forEach(card =>
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('sel'));
      card.classList.add('sel');
      applyMode(card.dataset.mode);
    })
  );

  // sqlmap toggle
  const sw = document.getElementById('sqlmapSwitch');
  sw?.addEventListener('click', () => {
    if (sw.classList.contains('on')) {
      sw.classList.remove('on');
    } else {
      if (confirm('sqlmap sends intrusive requests.\nConfirm authorization to run it against this target.')) {
        sw.classList.add('on');
      }
    }
  });

  // start gating
  const auth  = document.getElementById('authCheck');
  const start = document.getElementById('startBtn');
  const tgt   = document.getElementById('targetInput');
  const gate  = () => { start.disabled = !(auth?.checked && tgt?.value.trim()); };
  auth?.addEventListener('change', gate);
  tgt?.addEventListener('input', gate);
  start?.addEventListener('click', startScan);

  // cancel
  document.getElementById('cancelBtn')?.addEventListener('click', () => {
    stopPolling(); setPill('online', 'connected');
    toast('Polling stopped. Backend scan may still be running.', '⏸');
  });

  // report
  document.getElementById('downloadBtn')?.addEventListener('click', downloadReport);
  document.getElementById('newScanBtn')?.addEventListener('click', () => switchView('scan'));

  // history
  document.getElementById('refreshHistBtn')?.addEventListener('click', loadHistory);
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════════════════ */
function switchView(name) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === name));
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  const [title, sub] = VIEW_META[name] || [name, ''];
  $('topTitle').textContent = title;
  $('topSub').textContent   = sub;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCAN MODE
═══════════════════════════════════════════════════════════════════════════ */
function applyMode(mode) {
  const cfg = {
    url:       { label: 'Target URL',    ph: 'https://your-authorized-target.com',  hint: 'Full URL of the authorized target', adv: true  },
    localhost: { label: 'Local Address', ph: 'http://localhost:3000',               hint: 'URL of your local dev server',      adv: true  },
    codebase:  { label: 'Project Path',  ph: '/absolute/path/to/project',           hint: 'Absolute filesystem path to the source folder', adv: false },
  };
  const c = cfg[mode] || cfg.url;
  const lbl = document.getElementById('targetLabel');
  const inp = document.getElementById('targetInput');
  const hnt = document.getElementById('targetHint');
  const adv = document.getElementById('advPanel');
  if (lbl) lbl.textContent       = c.label;
  if (inp) inp.placeholder       = c.ph;
  if (hnt) hnt.textContent       = c.hint;
  if (adv) adv.style.display     = c.adv ? '' : 'none';
}

/* ═══════════════════════════════════════════════════════════════════════════
   START SCAN
═══════════════════════════════════════════════════════════════════════════ */
async function startScan() {
  const target     = $('targetInput')?.value.trim();
  const mode       = document.querySelector('.mode-card.sel')?.dataset.mode || 'url';
  const model      = $('modelSelect')?.value || '';
  const wordlist   = $('wordlistInput')?.value.trim() || '';
  const nucleiSev  = $('nucleiSev')?.value.trim() || 'low,medium,high,critical';
  const ollamaHost = $('ollamaHost')?.value.trim() || 'http://localhost:11434';
  const sqlmap     = $('sqlmapSwitch')?.classList.contains('on') || false;
  const errEl      = $('startError');

  if (!target) {
    if (errEl) { errEl.textContent = 'Enter a target first.'; errEl.style.display = 'inline'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  resetRunView(target, mode);
  switchView('run');
  $('run-badge').style.display = 'inline-block';
  setPill('loading', 'scanning…');

  try {
    const res = await fetch(`${API_BASE}/api/scan/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, mode, model, wordlist,
        ollama_host: ollamaHost, enable_sqlmap: sqlmap, nuclei_severity: nucleiSev }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    currentScanId = (await res.json()).scan_id;
    startPolling(currentScanId);
  } catch (err) {
    appendLog({ level: 'error', msg: `Failed to start: ${err.message}` });
    $('cancelBtn').disabled = false;
    setPill('offline', 'error');
    toast(`Error: ${err.message}`, '✗');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUNNING VIEW — reset
═══════════════════════════════════════════════════════════════════════════ */
function resetRunView(target, mode) {
  lastLogCount   = 0;
  toolStartTimes = {};

  $('runTarget').textContent = target;
  $('runMode').textContent   = `mode: ${mode}`;
  setScanBadge('idle', 'idle');
  setProgress(0, 'starting…');

  // reset phase strip
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`phase-${i}`)?.classList.remove('active','done');
    const pb = document.getElementById(`pbar-${i}`);
    if (pb) pb.style.width = '0%';
    // remove scan anim if any
    document.getElementById(`pbar-${i}`)?.parentElement.querySelector('.phase-scan-anim')?.remove();
  }

  // log
  const logBox = $('logBox');
  if (logBox) logBox.innerHTML = '<span class="ll info">Scan queued — waiting for first response<span class="cursor"></span></span>';

  $('cancelBtn').disabled = false;
  $('logCount').textContent = '';

  // Build tool cards
  const grid = $('toolGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const visible = mode === 'codebase'
    ? TOOL_DEFS.filter(t => t.phase === 'code' || t.phase === 'ai')
    : TOOL_DEFS.filter(t => t.phase !== 'code');

  visible.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.id = `tc-${t.key}`;
    card.innerHTML = `
      <div class="tool-pip pending" id="tp-${t.key}"></div>
      <div class="tool-name">${esc(t.label)}</div>
      <div class="tool-stat" id="ts-${t.key}">queued</div>
      <div class="tool-time" id="tt-${t.key}"></div>`;
    grid.appendChild(card);
  });
}

function setToolState(key, state, label) {
  const card = document.getElementById(`tc-${key}`);
  const pip  = document.getElementById(`tp-${key}`);
  const stat = document.getElementById(`ts-${key}`);
  if (card) card.className = `tool-card ${state}`;
  if (pip)  pip.className  = `tool-pip ${state}`;
  if (stat) stat.textContent = label;
  if (state === 'running' && !toolStartTimes[key]) toolStartTimes[key] = Date.now();
  if (state === 'done' && toolStartTimes[key]) {
    const el = document.getElementById(`tt-${key}`);
    if (el) el.textContent = `${((Date.now()-toolStartTimes[key])/1000).toFixed(1)}s`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   POLLING
═══════════════════════════════════════════════════════════════════════════ */
function startPolling(id) { stopPolling(); pollTimer = setInterval(() => poll(id), 900); poll(id); }
function stopPolling()    { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function poll(id) {
  try {
    const r = await fetch(`${API_BASE}/api/scan/${id}/status`, { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    renderUpdate(data);
    if (data.status === 'done')  { stopPolling(); onDone(id); }
    if (data.status === 'error') { stopPolling(); onError(); }
  } catch (_) {}
}

function renderUpdate({ logs, status, target }) {
  setScanBadge(status, status);

  const newLines = logs.slice(lastLogCount);
  lastLogCount = logs.length;
  newLines.forEach(appendLog);

  inferTools(logs);
  updatePhases(logs);
  const pct = estimatePct(logs);
  setProgress(pct, buildLabel(logs, status));

  const lc = $('logCount');
  if (lc) lc.textContent = `${logs.length} lines`;

  const sub = $('topSub');
  if (sub && document.getElementById('view-run')?.classList.contains('active'))
    sub.textContent = `${target} — ${status}`;
}

/* ── Infer tool states from logs ─────────────────────────────────────────── */
function inferTools(logs) {
  const state = {};
  logs.forEach(e => {
    const msg = (e.msg || '').toLowerCase();
    TOOL_DEFS.forEach(t => {
      const kl = t.key.toLowerCase();
      const ll = t.label.toLowerCase().replace(' ', '');
      if (!(msg.includes(kl) || msg.includes(ll))) return;
      if (e.level === 'done'  && !msg.includes('running')) state[t.key] = 'done';
      else if (e.level === 'tool' && msg.includes('running')) state[t.key] = 'running';
    });
    if (e.level === 'tool' && msg.includes('analys')) state['ollama'] = 'running';
    if (e.level === 'done' && msg.includes('executive summary')) state['ollama'] = 'done';
    if (e.level === 'done' && msg.includes('analysis done'))
      TOOL_DEFS.forEach(t => { if (msg.includes(t.key)) state[t.key] = 'done'; });
  });
  Object.entries(state).forEach(([k, s]) => {
    setToolState(k, s, { running: 'running…', done: 'done ✓', error: 'error' }[s] || 'queued');
  });
}

/* ── Update phase strip ──────────────────────────────────────────────────── */
function updatePhases(logs) {
  let maxPhase = 0;
  logs.forEach(e => {
    const m = (e.msg || '').toLowerCase();
    for (let i = 1; i <= 4; i++) { if (m.includes(`phase ${i}`)) maxPhase = Math.max(maxPhase, i); }
  });
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`phase-${i}`);
    if (!el) continue;
    if (i < maxPhase) {
      el.classList.remove('active'); el.classList.add('done');
      const pb = document.getElementById(`pbar-${i}`);
      if (pb) pb.style.width = '100%';
      el.querySelector('.phase-scan-anim')?.remove();
    } else if (i === maxPhase) {
      el.classList.add('active'); el.classList.remove('done');
      if (!el.querySelector('.phase-scan-anim')) {
        const anim = document.createElement('div');
        anim.className = 'phase-scan-anim';
        el.appendChild(anim);
      }
    } else {
      el.classList.remove('active','done');
    }
  }
}

/* ── Progress estimate ───────────────────────────────────────────────────── */
function estimatePct(logs) {
  if (!logs.length) return 2;
  let maxPhase = 0, done = 0;
  logs.forEach(e => {
    const m = (e.msg || '').toLowerCase();
    for (let i = 1; i <= 4; i++) if (m.includes(`phase ${i}`)) maxPhase = Math.max(maxPhase, i);
    if (e.level === 'done') done++;
  });
  return Math.min(Math.round((maxPhase/4)*80 + Math.min(done*3,20)), 98);
}

function buildLabel(logs, status) {
  if (status === 'done') return 'complete ✓';
  const labels = ['Phase 1: Recon','Phase 2: Scanning','Phase 3: AI Analysis','Phase 4: Report'];
  let cur = 0;
  logs.forEach(e => {
    const m = (e.msg||'').toLowerCase();
    labels.forEach((_,i) => { if (m.includes(`phase ${i+1}`)) cur = i; });
  });
  return labels[cur];
}

function setProgress(pct, lbl) {
  const bar = $('progressBar'); const p = $('progressPct'); const l = $('progressLbl');
  if (bar) bar.style.width   = `${pct}%`;
  if (p)   p.textContent     = `${pct}%`;
  if (l)   l.textContent     = lbl || '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOG
═══════════════════════════════════════════════════════════════════════════ */
function appendLog(entry) {
  const box = $('logBox');
  if (!box) return;
  // Remove cursor from last line
  box.querySelector('.cursor')?.remove();
  const line = document.createElement('span');
  line.className = `ll ${entry.level || 'info'}`;
  const ts = entry.ts ? `<span class="ll-ts">${esc(entry.ts)}</span>` : '';
  line.innerHTML = `${ts}${esc(entry.msg || '')}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCAN DONE / ERROR
═══════════════════════════════════════════════════════════════════════════ */
async function onDone(scanId) {
  setProgress(100, 'complete ✓');
  setScanBadge('done', 'done');
  $('cancelBtn').disabled = true;
  $('run-badge').style.display = 'none';
  TOOL_DEFS.forEach(t => setToolState(t.key, 'done', 'done ✓'));
  // mark all phases done
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`phase-${i}`)?.classList.add('done');
    document.getElementById(`phase-${i}`)?.classList.remove('active');
    document.getElementById(`phase-${i}`)?.querySelector('.phase-scan-anim')?.remove();
    const pb = document.getElementById(`pbar-${i}`);
    if (pb) pb.style.width = '100%';
  }
  appendLog({ level: 'done', msg: '✓ Scan complete — fetching report…' });
  toast('Scan complete! Loading report…', '✓');
  setPill('online', 'connected');

  try {
    const r    = await fetch(`${API_BASE}/api/scan/${scanId}/report`, { cache: 'no-store' });
    const data = await r.json();
    if (data.report_md) { showReport(data.report_md, data.report_path); setTimeout(() => switchView('report'), 700); }
  } catch (err) { toast(`Could not load report: ${err.message}`, '✗'); }
}

function onError() {
  setProgress(0, 'error');
  setScanBadge('error', 'error');
  $('cancelBtn').disabled = true;
  $('run-badge').style.display = 'none';
  appendLog({ level: 'error', msg: '✗ Scan failed — check log above.' });
  toast('Scan encountered an error.', '✗');
  setPill('offline', 'error');
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORT
═══════════════════════════════════════════════════════════════════════════ */
let _md = null, _path = null;

function showReport(md, filePath) {
  _md = md; _path = filePath || null;
  $('reportEmpty').style.display = 'none';
  $('reportBody').style.display  = 'block';
  $('mdViewer').innerHTML        = renderMd(md);
  const pe = $('reportPath');
  if (pe) pe.textContent = filePath ? `→ ${filePath}` : '';
}

function downloadReport() {
  if (!_md) return;
  const fname = _path ? _path.split(/[/\\]/).pop() : `sudarshan_report_${Date.now()}.md`;
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([_md], { type: 'text/markdown' })),
    download: fname,
  });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
  toast(`Downloaded: ${fname}`, '⬇');
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════════════════════════════════════ */
async function loadHistory() {
  const list = $('histList');
  if (!list) return;
  list.innerHTML = `<div class="empty"><div class="spin" style="width:22px;height:22px"></div><div class="empty-hint">Loading…</div></div>`;
  try {
    const data = await fetch(`${API_BASE}/api/history`, { cache: 'no-store' }).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">📂</div><div class="empty-msg">No scans yet</div><div class="empty-hint">Run your first scan to see results here.</div></div>`;
      return;
    }
    list.innerHTML = '';
    data.forEach(item => {
      const fname  = item.filename || '';
      const stem   = fname.replace(/^sudarshan_report_/,'').replace(/\.md$/,'');
      const parts  = stem.split('_');
      const target = parts.slice(0, parts.length - 2).join('_') || fname;
      const mtime  = item.mtime ? new Date(item.mtime).toLocaleString('en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      const size   = item.size  ? `${Math.round(item.size/1024)}KB` : '';
      const row    = document.createElement('div');
      row.className = 'hist-item';
      row.innerHTML = `
        <div class="hist-icon"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/></svg></div>
        <div class="hist-name" title="${esc(fname)}">${esc(target)}</div>
        <div class="hist-size">${esc(size)}</div>
        <div class="hist-date">${esc(mtime)}</div>`;
      row.addEventListener('click', () => openHist(fname));
      list.appendChild(row);
    });
  } catch (_) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-msg">Could not load history</div><div class="empty-hint">Is the backend running?</div></div>`;
  }
}

async function openHist(fname) {
  try {
    const data = await fetch(`${API_BASE}/api/history/${encodeURIComponent(fname)}`,{cache:'no-store'}).then(r=>r.json());
    showReport(data.content, null);
    switchView('report');
  } catch (err) { toast(`Could not open: ${err.message}`, '✗'); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARKDOWN
═══════════════════════════════════════════════════════════════════════════ */
function renderMd(md) {
  if (!md) return '';
  if (typeof window.marked !== 'undefined') {
    try {
      const fn  = window.marked.parse || window.marked;
      return fn(md, { gfm: true, breaks: false })
        .replace(/<a href=/g, '<a target="_blank" rel="noopener" href=');
    } catch (_) {}
  }
  // fallback
  const e2 = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return md
    .replace(/```[\w]*\n([\s\S]*?)```/gm, (_,c) => `<pre><code>${e2(c)}</code></pre>`)
    .replace(/^#### (.+)$/gm,'<h4>$1</h4>').replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^---+$/gm,'<hr>').replace(/\n{2,}/g,'</p><p>').replace(/^/,'<p>') + '</p>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function $(id)            { return document.getElementById(id); }

function setPill(state, label) {
  const pill = $('statusPill'), lbl = $('statusLabel');
  if (pill) pill.className = `status-pill ${state}`;
  if (lbl)  lbl.textContent = label;
}

function setScanBadge(cls, text) {
  const el = $('runBadge');
  if (!el) return;
  el.className = `scan-status-badge ${cls}`;
  el.textContent = text;
}

let _toastT = null;
function toast(msg, icon = '') {
  const el   = $('toast');
  const iconEl = $('toast-icon');
  const msgEl  = $('toast-msg');
  if (!el) return;
  if (iconEl) iconEl.textContent = icon;
  if (msgEl)  msgEl.textContent  = msg;
  el.className = 'show' + (msg.includes('Error') || icon === '✗' ? ' error' : icon === '✓' || icon === '⬇' ? ' success' : '');
  if (_toastT) clearTimeout(_toastT);
  _toastT = setTimeout(() => { el.className = el.className.replace('show','').trim(); }, 4500);
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
