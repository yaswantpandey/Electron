"""
code_scan.py — Static analysis wrappers for codebase mode
Tools: semgrep, gitleaks, pip-audit, npm audit
"""

from __future__ import annotations

import subprocess
import shutil
import os
import json
from rich.console import Console

console = Console()


def _tool_available(name: str) -> bool:
    return shutil.which(name) is not None


def _run(cmd: list[str], label: str, cwd: str | None = None, timeout: int = 300) -> str:
    console.print(f"[cyan]  → Running:[/cyan] {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        output = result.stdout.strip()
        if result.returncode not in (0, 1) and result.stderr:
            # returncode=1 is normal for semgrep/pip-audit (findings found)
            console.print(f"[yellow]  [WARN] {label} stderr:[/yellow] {result.stderr[:500]}")
        return output if output else "(no findings / no output)"
    except FileNotFoundError:
        return f"[NOT INSTALLED] {label} — install it per the documentation."
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT] {label} exceeded {timeout} s."
    except Exception as exc:
        return f"[ERROR] {label}: {exc}"


# ---------------------------------------------------------------------------
# semgrep — SAST: pattern-based code vulnerability detection
# ---------------------------------------------------------------------------

def run_semgrep(target_path: str) -> str:
    """
    Run semgrep against *target_path* using the auto-selected rule set.
    Returns JSON output for AI analysis.
    """
    if not _tool_available("semgrep"):
        return "[NOT INSTALLED] semgrep — pip install semgrep"

    cmd = [
        "semgrep",
        "--config", "auto",   # auto-selects OWASP/security rules
        "--json",
        "--quiet",
        target_path,
    ]
    raw = _run(cmd, "semgrep", timeout=600)

    # Pretty-print JSON if valid, otherwise return raw
    try:
        parsed = json.loads(raw)
        findings = parsed.get("results", [])
        if not findings:
            return "(semgrep: no findings)"
        # Return a condensed summary per finding
        lines = []
        for f in findings:
            lines.append(
                f"  [{f.get('extra', {}).get('severity', 'N/A')}] "
                f"{f.get('check_id', 'N/A')} — "
                f"{f.get('path', '')}:{f.get('start', {}).get('line', '?')}\n"
                f"    {f.get('extra', {}).get('message', '')}"
            )
        return "\n".join(lines)
    except (json.JSONDecodeError, TypeError):
        return raw


# ---------------------------------------------------------------------------
# gitleaks — secret / credential leak detection
# ---------------------------------------------------------------------------

def run_gitleaks(target_path: str) -> str:
    """
    Scan *target_path* for committed secrets / credentials with gitleaks.
    """
    if not _tool_available("gitleaks"):
        return (
            "[NOT INSTALLED] gitleaks — download the binary from "
            "https://github.com/gitleaks/gitleaks/releases"
        )

    cmd = [
        "gitleaks",
        "detect",
        "--source", target_path,
        "--no-git",          # works even outside a git repo
        "--report-format", "json",
        "--report-path", "-", # output to stdout
        "--quiet",
    ]
    return _run(cmd, "gitleaks", timeout=300)


# ---------------------------------------------------------------------------
# pip-audit — Python dependency vulnerability check
# ---------------------------------------------------------------------------

def run_pip_audit(target_path: str) -> str:
    """
    Run pip-audit against any requirements.txt found under *target_path*.
    """
    if not _tool_available("pip-audit") and not _tool_available("pip_audit"):
        return "[NOT INSTALLED] pip-audit — pip install pip-audit"

    req_file = os.path.join(target_path, "requirements.txt")
    if not os.path.isfile(req_file):
        return "(pip-audit: no requirements.txt found at target path)"

    binary = "pip-audit" if _tool_available("pip-audit") else "pip_audit"
    cmd = [
        binary,
        "-r", req_file,
        "--format", "json",
    ]
    return _run(cmd, "pip-audit", cwd=target_path)


# ---------------------------------------------------------------------------
# npm audit — Node.js dependency vulnerability check
# ---------------------------------------------------------------------------

def run_npm_audit(target_path: str) -> str:
    """
    Run npm audit inside *target_path* if a package.json exists.
    """
    if not _tool_available("npm"):
        return "[NOT INSTALLED] npm — install Node.js from https://nodejs.org"

    pkg_file = os.path.join(target_path, "package.json")
    if not os.path.isfile(pkg_file):
        return "(npm audit: no package.json found at target path)"

    cmd = ["npm", "audit", "--json"]
    return _run(cmd, "npm audit", cwd=target_path)


# ---------------------------------------------------------------------------
# Public entry point called by main.py
# ---------------------------------------------------------------------------

def run_code_scan(target: str) -> dict:
    """
    Run the full static analysis suite against the *target* directory.

    Returns:
        {
            "semgrep":   <str>,
            "gitleaks":  <str>,
            "pip_audit": <str>,
            "npm_audit": <str>,
        }
    """
    if not os.path.isdir(target):
        msg = f"[ERROR] Target path '{target}' is not a directory. Codebase mode requires a valid path."
        console.print(f"[red]{msg}[/red]")
        return {k: msg for k in ("semgrep", "gitleaks", "pip_audit", "npm_audit")}

    results: dict = {}

    console.print("\n[bold green][CODE SCAN] semgrep[/bold green]")
    results["semgrep"] = run_semgrep(target)

    console.print("\n[bold green][CODE SCAN] gitleaks[/bold green]")
    results["gitleaks"] = run_gitleaks(target)

    console.print("\n[bold green][CODE SCAN] pip-audit[/bold green]")
    results["pip_audit"] = run_pip_audit(target)

    console.print("\n[bold green][CODE SCAN] npm audit[/bold green]")
    results["npm_audit"] = run_npm_audit(target)

    return results
