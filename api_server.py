"""
api_server.py — Flask REST API + Web UI server for Sudarshan AI.

REST Endpoints:
  POST /api/scan/start      — kick off a scan (non-blocking, returns scan_id)
  GET  /api/scan/<id>/status — poll status + streaming log lines
  GET  /api/scan/<id>/report — fetch the finished report (Markdown text)
  GET  /api/history          — list past reports from the reports/ directory
  GET  /api/history/<fname>  — read a specific report file
  GET  /api/health           — simple liveness check

Web UI (served from web/ directory):
  GET  /                     — serves web/index.html
  GET  /app.js               — serves web/app.js
  GET  /static/marked.min.js — serves renderer/marked.min.js

Scans run in a background thread. Log lines are appended to a per-scan
buffer that the UI polls. When the scan finishes, the report path is stored
so the UI can fetch the Markdown.
"""

from __future__ import annotations

import os
import sys
import uuid
import threading
import traceback
from datetime import datetime
from typing import Optional

from flask import Flask, request, jsonify, Response, abort, send_from_directory, send_file
from flask_cors import CORS

# ── Path setup ───────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from modules import recon, web_scan, code_scan, ollama_client, report as report_mod

WEB_DIR      = os.path.join(ROOT, "web")
RENDERER_DIR = os.path.join(ROOT, "renderer")

app = Flask(__name__, static_folder=None)
CORS(app)  # allow the Electron renderer (file:// or localhost) to call this


# ── Web UI routes ─────────────────────────────────────────────────────────────

@app.route("/")
def ui_index():
    return send_from_directory(WEB_DIR, "index.html")

@app.route("/app.js")
def ui_app_js():
    return send_from_directory(WEB_DIR, "app.js")

@app.route("/static/<path:filename>")
def ui_static(filename):
    # Serve marked.min.js from renderer/ directory
    safe = os.path.realpath(os.path.join(RENDERER_DIR, filename))
    if not safe.startswith(os.path.realpath(RENDERER_DIR)):
        abort(403)
    return send_from_directory(RENDERER_DIR, filename)

# ── In-memory scan registry ──────────────────────────────────────────────────
# scan_id -> {
#   "status": "running" | "done" | "error",
#   "logs":   [str, ...],
#   "report_path": str | None,
#   "report_md":   str | None,
#   "started_at":  str,
#   "target":      str,
#   "mode":        str,
# }
_scans: dict[str, dict] = {}
_lock = threading.Lock()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _log(scan_id: str, msg: str, level: str = "info") -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    entry = {"ts": ts, "level": level, "msg": msg}
    with _lock:
        _scans[scan_id]["logs"].append(entry)


def _run_scan(
    scan_id: str,
    target: str,
    mode: str,
    enable_sqlmap: bool,
    wordlist: str,
    ollama_host: str,
    model: str,
    nuclei_severity: str,
) -> None:
    """Background thread: full scan pipeline."""
    try:
        _log(scan_id, f"Scan started → target={target}  mode={mode}", "info")

        # ── Phase 1: Recon ───────────────────────────────────────────────────
        _log(scan_id, "Phase 1 — Recon", "phase")
        if mode == "codebase":
            _log(scan_id, "Codebase mode — skipping network recon", "info")
            recon_results = {
                "subfinder": "N/A (codebase mode)",
                "httpx":     "N/A (codebase mode)",
                "katana":    "N/A (codebase mode)",
            }
        else:
            _log(scan_id, "Running subfinder …", "tool")
            sf = recon.run_subfinder(target)
            recon_results = {"subfinder": sf}
            _log(scan_id, f"subfinder done — {len(sf.splitlines())} lines", "done")

            _log(scan_id, "Running httpx (ProjectDiscovery) …", "tool")
            hx = recon.run_httpx(sf, target)
            recon_results["httpx"] = hx
            _log(scan_id, "httpx done", "done")

            _log(scan_id, "Running katana …", "tool")
            kt = recon.run_katana(target)
            recon_results["katana"] = kt
            _log(scan_id, "katana done", "done")

        # ── Phase 2: Scan ────────────────────────────────────────────────────
        if mode == "codebase":
            _log(scan_id, "Phase 2 — Static Code Analysis", "phase")
            _log(scan_id, "Running semgrep …", "tool")
            _log(scan_id, "Running gitleaks …", "tool")
            _log(scan_id, "Running pip-audit …", "tool")
            _log(scan_id, "Running npm audit …", "tool")
            scan_results = code_scan.run_code_scan(target)
            _log(scan_id, "Code scan phase complete", "done")
        else:
            _log(scan_id, "Phase 2 — Web Vulnerability Scanning", "phase")
            _log(scan_id, "Running nuclei …", "tool")
            n_out = web_scan.run_nuclei(target, severity=nuclei_severity)
            scan_results = {"nuclei": n_out}
            _log(scan_id, "nuclei done", "done")

            _log(scan_id, "Running ffuf …", "tool")
            ff_out = web_scan.run_ffuf(target, wordlist=wordlist)
            scan_results["ffuf"] = ff_out
            _log(scan_id, "ffuf done", "done")

            if enable_sqlmap:
                _log(scan_id, "Running sqlmap (intrusive) …", "warn")
                sq_out = web_scan.run_sqlmap(target)
                scan_results["sqlmap"] = sq_out
                _log(scan_id, "sqlmap done", "done")
            else:
                scan_results["sqlmap"] = "Skipped (--enable-sqlmap not set)"

        all_results = {**recon_results, **scan_results}

        # ── Phase 3: AI Analysis ─────────────────────────────────────────────
        _log(scan_id, "Phase 3 — AI Analysis (Ollama)", "phase")
        analyses = {}
        for tool_name, raw in all_results.items():
            _log(scan_id, f"Analysing {tool_name} with {model} …", "tool")
            analyses[tool_name] = ollama_client.analyze(
                tool_name=tool_name,
                raw_output=raw,
                target=target,
                model=model,
                host=ollama_host,
            )
            _log(scan_id, f"{tool_name} analysis done", "done")

        _log(scan_id, "Generating executive summary …", "tool")
        exec_sum = ollama_client.executive_summary(
            all_analyses=analyses,
            target=target,
            model=model,
            host=ollama_host,
        )
        _log(scan_id, "Executive summary ready", "done")

        # ── Phase 4: Report ──────────────────────────────────────────────────
        _log(scan_id, "Phase 4 — Building report", "phase")
        rpath = report_mod.build_report(
            target=target,
            mode=mode,
            model=model,
            scan_results=all_results,
            analyses=analyses,
            executive_summary=exec_sum,
            output_dir=os.path.join(ROOT, "reports"),
        )

        # Read the report Markdown so the UI can display it inline
        with open(rpath, "r", encoding="utf-8") as fh:
            report_md = fh.read()

        with _lock:
            _scans[scan_id]["status"] = "done"
            _scans[scan_id]["report_path"] = rpath
            _scans[scan_id]["report_md"] = report_md

        _log(scan_id, f"Scan complete — report saved to {rpath}", "done")

    except Exception as exc:
        tb = traceback.format_exc()
        _log(scan_id, f"FATAL ERROR: {exc}\n{tb}", "error")
        with _lock:
            _scans[scan_id]["status"] = "error"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "ts": datetime.now().isoformat()})


@app.route("/api/scan/start", methods=["POST"])
def scan_start():
    data = request.get_json(force=True) or {}

    target      = (data.get("target") or "").strip()
    mode        = (data.get("mode") or "url").strip().lower()
    enable_sqlmap = bool(data.get("enable_sqlmap", False))
    wordlist    = (data.get("wordlist") or "/usr/share/wordlists/dirb/common.txt").strip()
    ollama_host = (data.get("ollama_host") or "http://localhost:11434").strip()
    model       = (data.get("model") or "hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M").strip()
    nuclei_sev  = (data.get("nuclei_severity") or "low,medium,high,critical").strip()

    if not target:
        return jsonify({"error": "target is required"}), 400
    if mode not in ("url", "localhost", "codebase"):
        return jsonify({"error": "mode must be url, localhost, or codebase"}), 400

    scan_id = str(uuid.uuid4())
    with _lock:
        _scans[scan_id] = {
            "status":      "running",
            "logs":        [],
            "report_path": None,
            "report_md":   None,
            "started_at":  datetime.now().isoformat(),
            "target":      target,
            "mode":        mode,
        }

    t = threading.Thread(
        target=_run_scan,
        args=(scan_id, target, mode, enable_sqlmap, wordlist, ollama_host, model, nuclei_sev),
        daemon=True,
    )
    t.start()

    return jsonify({"scan_id": scan_id}), 202


@app.route("/api/scan/<scan_id>/status")
def scan_status(scan_id: str):
    with _lock:
        entry = _scans.get(scan_id)
    if not entry:
        abort(404)
    return jsonify({
        "scan_id":    scan_id,
        "status":     entry["status"],
        "logs":       entry["logs"],
        "target":     entry["target"],
        "mode":       entry["mode"],
        "started_at": entry["started_at"],
        "has_report": entry["report_path"] is not None,
    })


@app.route("/api/scan/<scan_id>/report")
def scan_report(scan_id: str):
    with _lock:
        entry = _scans.get(scan_id)
    if not entry:
        abort(404)
    if entry["status"] != "done":
        return jsonify({"error": "scan not finished yet"}), 409
    return jsonify({
        "scan_id":     scan_id,
        "report_path": entry["report_path"],
        "report_md":   entry["report_md"],
    })


@app.route("/api/history")
def history():
    reports_dir = os.path.join(ROOT, "reports")
    if not os.path.isdir(reports_dir):
        return jsonify([])
    files = []
    for fname in sorted(os.listdir(reports_dir), reverse=True):
        if fname.endswith(".md"):
            fpath = os.path.join(reports_dir, fname)
            stat = os.stat(fpath)
            # Parse target + date from filename: sudarshan_report_<target>_<YYYYMMDD_HHMMSS>.md
            parts = fname.replace(".md", "").split("_")
            files.append({
                "filename":  fname,
                "path":      fpath,
                "size":      stat.st_size,
                "mtime":     datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return jsonify(files)


@app.route("/api/history/<path:fname>")
def history_file(fname: str):
    reports_dir = os.path.join(ROOT, "reports")
    # Security: only serve files directly inside reports/
    safe = os.path.realpath(os.path.join(reports_dir, fname))
    if not safe.startswith(os.path.realpath(reports_dir)):
        abort(403)
    if not os.path.isfile(safe):
        abort(404)
    with open(safe, "r", encoding="utf-8") as fh:
        content = fh.read()
    return jsonify({"filename": fname, "content": content})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("SUDARSHAN_PORT", "5174"))
    print(f"[api_server] Starting on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
