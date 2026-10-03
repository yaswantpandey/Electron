/**
 * app.js — Sudarshan AI  |  Web GUI v2  |  DEMO MODE
 *
 * All API calls are replaced with local mock data.
 * No backend required — deploy as static files anywhere.
 */

'use strict';

/* ── Demo flag ─────────────────────────────────────────────────────────── */
const DEMO_MODE = true;

/* ── Mock report (real scan output, anonymised) ─────────────────────────── */
const DEMO_REPORT_MD = `# Sudarshan AI — Security Scan Report

| Field | Value |
|---|---|
| **Target** | \`https://example-target.com\` |
| **Mode** | \`url\` |
| **Model** | \`WhiteRabbitNeo-8B-v2.0\` |
| **Generated** | 2026-10-03 06:19 UTC |
| **Status** | ⚠️ Demo — findings are illustrative only |

> **Demo mode:** This report was generated against a real authorized target and is shown here as a sample. No live scanning is performed in this demo.

---

## Executive Summary

Analysis of the target revealed several medium-to-high severity findings across the recon and web-scanning phases:

1. **Recon (subfinder):** 21 subdomains discovered — no critical findings, but the attack surface is wider than expected for a personal site.
2. **Endpoint crawl (katana):** Multiple JavaScript assets with potential outdated dependencies; API endpoints exposed (\`/api/admin.php\`, \`/api/auth.php\`); Firebase tokens and reCAPTCHA config visible in JS bundles.
3. **Directory fuzzing (ffuf):** Sensitive paths return 403 (backup, uploads, .git, .env, phpmyadmin) — access controls in place but presence confirmed. \`robots.txt\` returns 200 with 53 lines of path hints.
4. **AI Analysis verdict:** No critical exploitable vulnerabilities confirmed in automated output. Manual verification recommended for CORS misconfiguration, CSRF on AJAX endpoints, and hardcoded Firebase credentials.

**Overall risk:** 🟡 Medium — no critical RCE/SQLi found; surface area and header misconfigurations warrant remediation.

---

## OWASP Top 10 (2021) Coverage

| ID | Category | Primary Tool(s) | Finding |
|---|---|---|---|
| A01 | Broken Access Control | ffuf | Sensitive dirs present (403) — verify bypass |
| A02 | Cryptographic Failures | nuclei | Not installed — manual TLS check recommended |
| A03 | Injection (SQLi / XSS) | sqlmap, nuclei | sqlmap skipped; XSS risk in dynamic params |
| A04 | Insecure Design | semgrep | N/A (url mode) |
| A05 | Security Misconfiguration | nuclei, ffuf | .git, .env paths confirmed present |
| A06 | Vulnerable Components | nuclei | Not installed — JS audit recommended |
| A07 | Authentication Failures | nuclei | Firebase token visible in JS bundle |
| A08 | Data Integrity Failures | gitleaks | N/A (url mode) |
| A09 | Logging & Monitoring | manual | Not assessed |
| A10 | SSRF | nuclei | Not installed |

---

## Detailed Findings by Tool

### Tool: \`subfinder\`

<details>
<summary>Raw output — 21 subdomains found</summary>

\`\`\`
cyclone.example-target.com
image.example-target.com
project.example-target.com
blog.example-target.com
api.example-target.com
admin.example-target.com
tools.example-target.com
resume.example-target.com
internship.example-target.com
course.example-target.com
www.example-target.com
\`\`\`
</details>

**AI Analysis (Sudarshan)**

21 subdomains discovered. No known CVEs map directly to subdomain enumeration output. However, the presence of \`admin.\`, \`api.\`, and \`tools.\` subdomains expands the attack surface significantly.

**Recommendation:** Probe each subdomain with httpx and nuclei separately. Prioritise \`admin.\` and \`api.\` subdomains.

**OWASP:** A01 (Broken Access Control) — widened attack surface.
**Severity:** 🟡 Low (informational — no direct exploit).

---

### Tool: \`katana\`

<details>
<summary>Raw output — 60+ endpoints crawled</summary>

\`\`\`
https://example-target.com/api/admin.php
https://example-target.com/api/auth.php
https://example-target.com/api/notes.php
https://example-target.com/api/settings.php
https://example-target.com/v1/token
https://example-target.com/v2/passwordPolicy
https://example-target.com/assets/firebaseAuth-B3_2A28u.js
https://example-target.com/assets/AuthModal-CDsoWnGC.js
https://example-target.com/assets/AdminDashboardPage-CQalzJmX.js
\`\`\`
</details>

**AI Analysis (Sudarshan)**

**Finding 1 — Firebase token exposure** 🔴 High
- Evidence: \`/v1/token\`, \`/v2/recaptchaConfig\`, \`firebaseAuth-*.js\` all present in crawl output.
- OWASP: A07 (Authentication Failures)
- Remediation: Audit Firebase JS bundle for hardcoded API keys; restrict key permissions in Firebase Console; enable App Check.

**Finding 2 — Admin endpoint exposed** 🟠 Medium
- Evidence: \`/api/admin.php\` reachable via unauthenticated crawl.
- OWASP: A01 (Broken Access Control)
- Remediation: Verify admin endpoints require authentication; test with unauthenticated session.

**Finding 3 — Missing CSP headers** 🟡 Medium
- Evidence: No Content-Security-Policy header observed in any response.
- OWASP: A05 (Security Misconfiguration)
- Remediation: Implement \`Content-Security-Policy: default-src 'self';\` at minimum.

**Finding 4 — CSRF risk on AJAX endpoints** 🟡 Medium
- Evidence: \`/api/settings.php\`, \`/api/notifications.php\` accessible without visible CSRF tokens.
- OWASP: A01 (Broken Access Control)
- Remediation: Add SameSite=Strict cookie attribute; implement CSRF token on state-changing endpoints.

---

### Tool: \`ffuf\`

<details>
<summary>Raw output — directory fuzzing</summary>

\`\`\`
.git       [Status: 403, Size: 787]
.env       [Status: 403, Size: 787]
backup     [Status: 403, Size: 787]
uploads    [Status: 403, Size: 787]
admin      [Status: 403, Size: 787]
phpmyadmin [Status: 403, Size: 787]
login      [Status: 403, Size: 787]
config     [Status: 403, Size: 787]
api        [Status: 301, Size: 795]
assets     [Status: 301, Size: 795]
robots.txt [Status: 200, Size: 1453]
\`\`\`
</details>

**AI Analysis (Sudarshan)**

**Finding 1 — .git directory present** 🟠 Medium
- Evidence: \`/.git\` returns 403 (present but access-controlled).
- OWASP: A05 (Security Misconfiguration)
- Remediation: Remove \`.git\` from web root or ensure server blocks all \`.git\` paths at the web server config level. A 403 is better than 200 but the directory should not be in the public root at all.

**Finding 2 — .env file present** 🟠 Medium
- Evidence: \`/.env\` returns 403 — file exists on server.
- OWASP: A02 (Cryptographic Failures) / A05 (Misconfiguration)
- Remediation: Move \`.env\` outside the web root entirely. Never store secrets in web-accessible paths.

**Finding 3 — robots.txt information disclosure** 🟢 Low
- Evidence: \`/robots.txt\` returns 200 with 53 lines — path hints for crawlers may reveal internal structure.
- OWASP: A05 (Security Misconfiguration)
- Remediation: Review \`robots.txt\` contents; do not rely on it for security. Remove sensitive path hints.

---

### Tool: \`sqlmap\`

Skipped — \`--enable-sqlmap\` not set. Enable only against confirmed injection points with explicit authorization.

---

## Recommended Next Steps

1. **Manually verify** every Medium/High finding above before reporting.
2. Install missing tools: \`httpx\`, \`nuclei\` (see \`tools.md\`).
3. Run \`nuclei -u https://example-target.com -s medium,high,critical\` for broader CVE coverage.
4. Audit Firebase bundle for hardcoded API keys — highest priority finding.
5. Test admin endpoint (\`/api/admin.php\`) with unauthenticated + low-privilege session.
6. Remove \`.git\` and \`.env\` from web root.

---
_Report generated by Sudarshan AI. All findings must be manually verified before submission or disclosure._
`;

const DEMO_HISTORY = [
  {
    filename: 'sudarshan_report_example-target.com_20261003_061930.md',
    mtime: new Date('2026-10-03T06:19:30').toISOString(),
    size: 8412,
  },
  {
    filename: 'sudarshan_report_example-target.com_20261001_165631.md',
    mtime: new Date('2026-10-01T16:56:31').toISOString(),
    size: 6103,
  },
  {
    filename: 'sudarshan_report_localhost_20261001_161743.md',
    mtime: new Date('2026-10-01T16:17:43').toISOString(),
    size: 4280,
  },
];

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
   BOOT — skip health check in demo mode, show app immediately
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  wireUI();
  showApp();           // skip backend health poll entirely
  loadHistory();       // populate history with mock data
  // Auto-load the demo report so Report tab has content immediately
  showReport(DEMO_REPORT_MD, 'reports/sudarshan_report_example-target.com_20261003_061930.md');
});

let _ready = false;
function showApp() {
  if (_ready) return;
  _ready = true;
  const boot = document.getElementById('boot');
  const app  = document.getElementById('app');
  if (boot) { boot.style.opacity = '0'; boot.style.transition = 'opacity .3s'; setTimeout(() => boot.remove(), 350); }
  if (app)  app.style.display = 'flex';
  setPill('online', 'demo mode');
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
  const gate  = () => { if (start) start.disabled = !(auth?.checked && tgt?.value.trim()); };
  auth?.addEventListener('change', gate);
  tgt?.addEventListener('input', gate);
  start?.addEventListener('click', startScan);

  // cancel
  document.getElementById('cancelBtn')?.addEventListener('click', () => {
    stopPolling(); setPill('online', 'demo mode');
    toast('Demo: polling stopped.', '⏸');
  });

  // report
  document.getElementById('downloadBtn')?.addEventListener('click', downloadReport);
  document.getElementById('newScanBtn')?.addEventListener('click', () => switchView('scan'));

  // history
  document.getElementById('refreshHistBtn')?.addEventListener('click', loadHistory);

  // Demo banner close
  document.getElementById('demoBannerClose')?.addEventListener('click', () => {
    const b = document.getElementById('demoBanner');
    if (b) b.style.display = 'none';
  });
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
   START SCAN — demo simulation
═══════════════════════════════════════════════════════════════════════════ */
async function startScan() {
  const target = $('targetInput')?.value.trim();
  const mode   = document.querySelector('.mode-card.sel')?.dataset.mode || 'url';
  const errEl  = $('startError');

  if (!target) {
    if (errEl) { errEl.textContent = 'Enter a target first.'; errEl.style.display = 'inline'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  resetRunView(target, mode);
  switchView('run');
  $('run-badge').style.display = 'inline-block';
  setPill('loading', 'demo scanning…');

  // Simulate a scan with a scripted sequence of log events
  simulateDemoScan(target, mode);
}

/* ── Demo scan simulation ────────────────────────────────────────────────── */
function simulateDemoScan(target, mode) {
  const isCode = mode === 'codebase';

  const events = isCode ? [
    { delay: 300,  level: 'phase', msg: 'Phase 1 — Recon' },
    { delay: 600,  level: 'info',  msg: 'Codebase mode — skipping network recon' },
    { delay: 1000, level: 'phase', msg: 'Phase 2 — Static Code Analysis' },
    { delay: 1200, level: 'tool',  msg: 'Running semgrep …' },
    { delay: 2800, level: 'done',  msg: 'semgrep done' },
    { delay: 3000, level: 'tool',  msg: 'Running gitleaks …' },
    { delay: 4200, level: 'done',  msg: 'gitleaks done' },
    { delay: 4400, level: 'tool',  msg: 'Running pip-audit …' },
    { delay: 5100, level: 'done',  msg: 'pip-audit done' },
    { delay: 5300, level: 'tool',  msg: 'Running npm audit …' },
    { delay: 6000, level: 'done',  msg: 'npm-audit done' },
    { delay: 6200, level: 'phase', msg: 'Phase 3 — AI Analysis (Ollama)' },
    { delay: 6400, level: 'tool',  msg: 'Analysing semgrep with WhiteRabbitNeo-8B …' },
    { delay: 7800, level: 'done',  msg: 'semgrep analysis done' },
    { delay: 8000, level: 'tool',  msg: 'Generating executive summary …' },
    { delay: 9200, level: 'done',  msg: 'Executive summary ready' },
    { delay: 9400, level: 'phase', msg: 'Phase 4 — Building report' },
    { delay: 9800, level: 'done',  msg: `Scan complete — report saved to reports/sudarshan_report_${target}_demo.md` },
  ] : [
    { delay: 300,  level: 'phase', msg: 'Phase 1 — Recon' },
    { delay: 500,  level: 'tool',  msg: 'Running subfinder …' },
    { delay: 2100, level: 'done',  msg: 'subfinder done — 21 lines' },
    { delay: 2300, level: 'tool',  msg: 'Running httpx (ProjectDiscovery) …' },
    { delay: 3600, level: 'done',  msg: 'httpx done' },
    { delay: 3800, level: 'tool',  msg: 'Running katana …' },
    { delay: 5400, level: 'done',  msg: 'katana done' },
    { delay: 5600, level: 'phase', msg: 'Phase 2 — Web Vulnerability Scanning' },
    { delay: 5800, level: 'tool',  msg: 'Running nuclei …' },
    { delay: 7200, level: 'done',  msg: 'nuclei done' },
    { delay: 7400, level: 'tool',  msg: 'Running ffuf …' },
    { delay: 9000, level: 'done',  msg: 'ffuf done' },
    { delay: 9200, level: 'phase', msg: 'Phase 3 — AI Analysis (Ollama)' },
    { delay: 9400, level: 'tool',  msg: 'Analysing subfinder with WhiteRabbitNeo-8B …' },
    { delay: 10600,level: 'done',  msg: 'subfinder analysis done' },
    { delay: 10800,level: 'tool',  msg: 'Analysing katana with WhiteRabbitNeo-8B …' },
    { delay: 12400,level: 'done',  msg: 'katana analysis done' },
    { delay: 12600,level: 'tool',  msg: 'Analysing ffuf with WhiteRabbitNeo-8B …' },
    { delay: 13800,level: 'done',  msg: 'ffuf analysis done' },
    { delay: 14000,level: 'tool',  msg: 'Generating executive summary …' },
    { delay: 15400,level: 'done',  msg: 'Executive summary ready' },
    { delay: 15600,level: 'phase', msg: 'Phase 4 — Building report' },
    { delay: 16000,level: 'done',  msg: `Scan complete — report saved to reports/sudarshan_report_${target}_demo.md` },
  ];

  // Build up a running log array and render incrementally
  const logAccum = [];
  const now = new Date();

  events.forEach(({ delay, level, msg }) => {
    setTimeout(() => {
      const ts = new Date(now.getTime() + delay).toTimeString().slice(0, 8);
      logAccum.push({ ts, level, msg });
      renderDemoUpdate([...logAccum], target);

      // When last event fires, show report
      if (delay === events[events.length - 1].delay) {
        setTimeout(() => onDemoScanDone(), 600);
      }
    }, delay);
  });
}

function renderDemoUpdate(logs, target) {
  setScanBadge('running', 'running');

  // Only append new lines since last render
  const newLines = logs.slice(lastLogCount);
  lastLogCount = logs.length;
  newLines.forEach(appendLog);

  inferTools(logs);
  updatePhases(logs);
  const pct = estimatePct(logs);
  setProgress(pct, buildLabel(logs, 'running'));

  const lc = $('logCount');
  if (lc) lc.textContent = `${logs.length} lines`;

  const sub = $('topSub');
  if (sub && document.getElementById('view-run')?.classList.contains('active'))
    sub.textContent = `${target} — running`;
}

function onDemoScanDone() {
  setProgress(100, 'complete ✓');
  setScanBadge('done', 'done');
  $('cancelBtn').disabled = true;
  $('run-badge').style.display = 'none';
  TOOL_DEFS.forEach(t => setToolState(t.key, 'done', 'done ✓'));
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`phase-${i}`)?.classList.add('done');
    document.getElementById(`phase-${i}`)?.classList.remove('active');
    document.getElementById(`phase-${i}`)?.querySelector('.phase-scan-anim')?.remove();
    const pb = document.getElementById(`pbar-${i}`);
    if (pb) pb.style.width = '100%';
  }
  appendLog({ level: 'done', msg: '✓ Demo scan complete — loading report…' });
  toast('Demo scan complete! Loading report…', '✓');
  setPill('online', 'demo mode');

  showReport(DEMO_REPORT_MD, 'reports/sudarshan_report_example-target.com_20261003_061930.md');
  setTimeout(() => switchView('report'), 700);
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

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`phase-${i}`)?.classList.remove('active','done');
    const pb = document.getElementById(`pbar-${i}`);
    if (pb) pb.style.width = '0%';
    document.getElementById(`pbar-${i}`)?.parentElement.querySelector('.phase-scan-anim')?.remove();
  }

  const logBox = $('logBox');
  if (logBox) logBox.innerHTML = '<span class="ll info">Demo scan queued<span class="cursor"></span></span>';

  $('cancelBtn').disabled = false;
  $('logCount').textContent = '';

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
   POLLING — not used in demo, stubs kept for compatibility
═══════════════════════════════════════════════════════════════════════════ */
function startPolling() {}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

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
  box.querySelector('.cursor')?.remove();
  const line = document.createElement('span');
  line.className = `ll ${entry.level || 'info'}`;
  const ts = entry.ts ? `<span class="ll-ts">${esc(entry.ts)}</span>` : '';
  line.innerHTML = `${ts}${esc(entry.msg || '')}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
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
  const fname = _path ? _path.split(/[/\\]/).pop() : `sudarshan_report_demo_${Date.now()}.md`;
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([_md], { type: 'text/markdown' })),
    download: fname,
  });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
  toast(`Downloaded: ${fname}`, '⬇');
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORY — served from mock data in demo mode
═══════════════════════════════════════════════════════════════════════════ */
function loadHistory() {
  const list = $('histList');
  if (!list) return;
  list.innerHTML = '';

  DEMO_HISTORY.forEach(item => {
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
    row.addEventListener('click', () => {
      showReport(DEMO_REPORT_MD, fname);
      switchView('report');
    });
    list.appendChild(row);
  });
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
  // fallback plain renderer
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
