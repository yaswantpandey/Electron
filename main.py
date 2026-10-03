#!/usr/bin/env python3
"""
main.py — Sudarshan AI CLI Orchestrator
Entry point for the security scanning and AI analysis pipeline.

Model: hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M (fixed)

Usage examples:
  python main.py --mode url       --target https://authorized-target.com
  python main.py --mode localhost --target http://localhost:3000
  python main.py --mode codebase  --target /path/to/project
  python main.py --mode url       --target https://target.com --enable-sqlmap
"""

import sys
import os
import yaml
import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# Make sure modules/ is importable when running from the project root
sys.path.insert(0, os.path.dirname(__file__))

from modules import recon, web_scan, code_scan, ollama_client, report

console = Console()

BANNER = """
  ███████╗██╗   ██╗██████╗  █████╗ ██████╗ ███████╗██╗  ██╗ █████╗ ███╗   ██╗
  ██╔════╝██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝██║  ██║██╔══██╗████╗  ██║
  ███████╗██║   ██║██║  ██║███████║██████╔╝███████╗███████║███████║██╔██╗ ██║
  ╚════██║██║   ██║██║  ██║██╔══██║██╔══██╗╚════██║██╔══██║██╔══██║██║╚██╗██║
  ███████║╚██████╔╝██████╔╝██║  ██║██║  ██║███████║██║  ██║██║  ██║██║ ╚████║
  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
                       AI-Assisted Bug Bounty & Security Research Toolkit
"""


def _load_config(path: str = "config.yaml") -> dict:
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    return {}


def _confirm_authorization(target: str, skip: bool) -> bool:
    """
    Ask the user to confirm they have authorization to test the target.
    Returns True if confirmed, False if not.
    """
    if skip:
        console.print(
            "[yellow]  --skip-confirm passed — authorization prompt bypassed.[/yellow]"
        )
        return True

    console.print(
        Panel(
            Text.assemble(
                ("⚠️  AUTHORIZATION CHECK\n\n", "bold yellow"),
                ("Target: ", "bold"),
                (f"{target}\n\n", "cyan"),
                (
                    "You must own this target, or have explicit written authorization\n"
                    "(bug bounty scope, signed engagement) to test it.\n\n"
                    "Unauthorized testing may violate laws including the CFAA.",
                    "white",
                ),
            ),
            border_style="yellow",
        )
    )
    answer = input("\nType 'yes' to confirm you are authorized: ").strip().lower()
    return answer == "yes"


# ---------------------------------------------------------------------------
# CLI definition
# ---------------------------------------------------------------------------

@click.command()
@click.option(
    "--mode",
    required=True,
    type=click.Choice(["url", "localhost", "codebase"], case_sensitive=False),
    help="Scan mode: url, localhost, or codebase (static analysis).",
)
@click.option(
    "--target",
    required=True,
    help="Target URL (url/localhost mode) or directory path (codebase mode).",
)
@click.option(
    "--enable-sqlmap",
    "enable_sqlmap",
    is_flag=True,
    default=False,
    help="Enable the intrusive sqlmap SQL injection test (opt-in).",
)
@click.option(
    "--wordlist",
    default=None,
    help="Path to a custom wordlist for ffuf (default from config.yaml).",
)
@click.option(
    "--skip-confirm",
    "skip_confirm",
    is_flag=True,
    default=False,
    help="Skip the authorization confirmation prompt (use with caution).",
)
@click.option(
    "--ollama-host",
    "ollama_host",
    default=None,
    help="Ollama server URL (default: http://localhost:11434).",
)
def main(
    mode: str,
    target: str,
    enable_sqlmap: bool,
    wordlist: str | None,
    skip_confirm: bool,
    ollama_host: str | None,
) -> None:
    """
    Sudarshan AI — OWASP-aligned security scan & AI analysis pipeline.

    Runs real tools against an authorized target, then uses a local Ollama
    LLM to produce a structured, OWASP-mapped findings report.
    Model: hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M
    """
    # ── Banner ───────────────────────────────────────────────────────────────
    console.print(BANNER, style="bold green")

    # ── Load config ──────────────────────────────────────────────────────────
    cfg = _load_config()
    ollama_cfg = cfg.get("ollama", {})
    scan_cfg = cfg.get("scan_defaults", {})
    report_cfg = cfg.get("report", {})

    # Fixed model — no override
    MODEL = "hf.co/redponike/Llama-3-WhiteRabbitNeo-8B-v2.0-GGUF:Q4_K_M"
    model = ollama_cfg.get("model", MODEL)

    if ollama_host is None:
        ollama_host = ollama_cfg.get("host", "http://localhost:11434")
    if wordlist is None:
        wordlist = scan_cfg.get("ffuf_wordlist", "/usr/share/wordlists/dirb/common.txt")

    nuclei_severity = scan_cfg.get("nuclei_severity", "low,medium,high,critical")
    output_dir = report_cfg.get("output_dir", "reports")

    # ── Print run summary ────────────────────────────────────────────────────
    console.print(
        Panel(
            Text.assemble(
                ("Mode:   ", "bold"), (mode, "cyan"), "\n",
                ("Target: ", "bold"), (target, "cyan"), "\n",
                ("Model:  ", "bold"), ("WhiteRabbitNeo (Q4_K_M)", "cyan"), "\n",
                ("SQLmap: ", "bold"), (("ENABLED ⚠️" if enable_sqlmap else "disabled"), "yellow" if enable_sqlmap else "green"),
            ),
            title="[bold]Sudarshan AI — Scan Configuration[/bold]",
            border_style="green",
        )
    )

    # ── Authorization check ──────────────────────────────────────────────────
    if not _confirm_authorization(target, skip_confirm):
        console.print("[bold red]\n✗ Authorization not confirmed. Aborting.[/bold red]")
        sys.exit(1)

    console.print("\n[bold green]✓ Authorization confirmed. Starting scan pipeline ...[/bold green]\n")

    # ── Phase 1: Recon ───────────────────────────────────────────────────────
    console.rule("[bold blue]Phase 1 — Recon")
    recon_results = recon.run_recon(target=target, mode=mode)

    # ── Phase 2: Vulnerability scanning ─────────────────────────────────────
    if mode == "codebase":
        console.rule("[bold blue]Phase 2 — Static Code Analysis")
        scan_results = code_scan.run_code_scan(target=target)
    else:
        console.rule("[bold blue]Phase 2 — Web Vulnerability Scanning")
        scan_results = web_scan.run_web_scan(
            target=target,
            mode=mode,
            nuclei_severity=nuclei_severity,
            wordlist=wordlist,
            enable_sqlmap=enable_sqlmap,
        )

    # ── Merge all tool results ───────────────────────────────────────────────
    all_results: dict = {**recon_results, **scan_results}

    # ── Phase 3: AI Analysis ─────────────────────────────────────────────────
    console.rule("[bold blue]Phase 3 — AI Analysis (Ollama)")
    analyses = ollama_client.analyze_all(
        scan_results=all_results,
        target=target,
        model=model,
        host=ollama_host,
    )

    # ── Executive Summary ────────────────────────────────────────────────────
    exec_summary = ollama_client.executive_summary(
        all_analyses=analyses,
        target=target,
        model=model,
        host=ollama_host,
    )

    # ── Phase 4: Report generation ───────────────────────────────────────────
    console.rule("[bold blue]Phase 4 — Report Generation")
    report_path = report.build_report(
        target=target,
        mode=mode,
        model=model,
        scan_results=all_results,
        analyses=analyses,
        executive_summary=exec_summary,
        output_dir=output_dir,
    )

    # ── Done ─────────────────────────────────────────────────────────────────
    console.print(
        Panel(
            Text.assemble(
                ("✅  Scan complete!\n\n", "bold green"),
                ("Report: ", "bold"),
                (report_path, "cyan"),
                ("\n\n⚠️  All findings are unverified until you manually confirm them.", "yellow"),
            ),
            border_style="green",
        )
    )


if __name__ == "__main__":
    main()
