"""
recon.py — Phase 1 Recon wrappers
Tools: subfinder, httpx (ProjectDiscovery), katana

NOTE: There is a name collision between the ProjectDiscovery 'httpx' binary
and the Python 'httpx' CLI that ships with the httpx Python library.
We detect the correct one by checking for a PD-specific flag (-silent).
"""

from __future__ import annotations

import subprocess
import shutil
from rich.console import Console

console = Console()


def _tool_available(name: str) -> bool:
    """Return True if the tool binary is on PATH."""
    return shutil.which(name) is not None


def _is_pd_httpx() -> bool:
    """
    Return True only if the 'httpx' on PATH is the ProjectDiscovery scanner
    (not the Python httpx CLI).  PD httpx accepts -version; the Python one does not.
    """
    if not _tool_available("httpx"):
        return False
    try:
        result = subprocess.run(
            ["httpx", "-version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        # PD httpx prints something like "v1.x.x" to stdout on success (rc=0)
        # Python httpx CLI exits with rc=1 on unknown option
        return result.returncode == 0
    except Exception:
        return False


def _run(cmd: list, label: str, timeout: int = 300) -> str:
    """Run a subprocess command and return stdout as a string."""
    console.print(f"[cyan]  → Running:[/cyan] {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout.strip()
        if result.returncode != 0 and result.stderr:
            console.print(f"[yellow]  [WARN] {label} stderr:[/yellow] {result.stderr[:500]}")
        return output if output else "(no output)"
    except FileNotFoundError:
        return f"[NOT INSTALLED] {label} — install it per the documentation."
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT] {label} exceeded {timeout} s — narrow scope or increase timeout."
    except Exception as exc:
        return f"[ERROR] {label}: {exc}"


# ---------------------------------------------------------------------------
# subfinder — passive subdomain enumeration
# ---------------------------------------------------------------------------

def run_subfinder(target: str) -> str:
    """
    Enumerate subdomains of *target* using subfinder.
    target should be a bare domain, e.g. 'example.com'.
    """
    if not _tool_available("subfinder"):
        return "[NOT INSTALLED] subfinder — see Section 4 of DOCUMENTATION.md"

    # Strip http(s):// if the user passed a full URL
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    cmd = ["subfinder", "-d", domain, "-silent"]
    return _run(cmd, "subfinder")


# ---------------------------------------------------------------------------
# httpx (ProjectDiscovery) — probe live hosts, grab status / title / tech stack
# ---------------------------------------------------------------------------

def run_httpx(targets_raw: str, target: str) -> str:
    """
    Probe a list of hosts (newline-separated string from subfinder output)
    or fall back to the original target.

    Returns a multi-line string of live hosts with metadata.
    """
    if not _is_pd_httpx():
        return (
            "[NOT INSTALLED] httpx (ProjectDiscovery) — "
            "install from: go install github.com/projectdiscovery/httpx/cmd/httpx@latest\n"
            "  (The Python 'httpx' CLI is present but is NOT the security scanner.)"
        )

    hosts = [h.strip() for h in targets_raw.splitlines() if h.strip()] or [target]

    cmd = [
        "httpx",
        "-silent",
        "-title",
        "-tech-detect",
        "-status-code",
        "-l", "-",   # read from stdin
    ]
    console.print(f"[cyan]  → Running:[/cyan] {' '.join(cmd)} (piping {len(hosts)} hosts)")
    try:
        result = subprocess.run(
            cmd,
            input="\n".join(hosts),
            capture_output=True,
            text=True,
            timeout=300,
        )
        return result.stdout.strip() or "(no live hosts found)"
    except FileNotFoundError:
        return "[NOT INSTALLED] httpx (ProjectDiscovery)"
    except subprocess.TimeoutExpired:
        return "[TIMEOUT] httpx exceeded 300 s"
    except Exception as exc:
        return f"[ERROR] httpx: {exc}"


# ---------------------------------------------------------------------------
# katana — endpoint / JS-link crawler
# ---------------------------------------------------------------------------

def run_katana(target: str) -> str:
    """
    Crawl *target* with katana and return discovered endpoints.
    Works in both url and localhost mode.
    """
    if not _tool_available("katana"):
        return "[NOT INSTALLED] katana — see Section 4 of DOCUMENTATION.md"

    cmd = [
        "katana",
        "-u", target,
        "-silent",
        "-depth", "3",
        "-jc",          # parse JS files for additional links
        "-kf", "all",   # keep all forms
    ]
    return _run(cmd, "katana")


# ---------------------------------------------------------------------------
# Public entry point called by main.py
# ---------------------------------------------------------------------------

def run_recon(target: str, mode: str) -> dict:
    """
    Run the full Phase 1 recon suite for the given target/mode.

    Returns a dict:
        {
            "subfinder": <str>,
            "httpx":     <str>,
            "katana":    <str>,
        }
    Codebase mode skips network recon entirely.
    """
    results: dict = {}

    if mode == "codebase":
        console.print("[yellow]  Codebase mode — skipping network recon.[/yellow]")
        results["subfinder"] = "N/A (codebase mode)"
        results["httpx"] = "N/A (codebase mode)"
        results["katana"] = "N/A (codebase mode)"
        return results

    console.print("\n[bold green][RECON] subfinder[/bold green]")
    subfinder_out = run_subfinder(target)
    results["subfinder"] = subfinder_out

    console.print("\n[bold green][RECON] httpx (ProjectDiscovery)[/bold green]")
    results["httpx"] = run_httpx(subfinder_out, target)

    console.print("\n[bold green][RECON] katana[/bold green]")
    results["katana"] = run_katana(target)

    return results
