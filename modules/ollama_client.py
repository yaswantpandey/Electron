"""
ollama_client.py — Local LLM interface via Ollama
Sends real tool output to the model and returns structured analysis.
"""

from __future__ import annotations

import json
import textwrap
from typing import Optional
import requests
from rich.console import Console

console = Console()

# Maximum characters of tool output to send per analysis request.
# Raise this value if analysis seems cut off (needs larger context window).
MAX_CHARS = 12_000

OLLAMA_HOST = "http://localhost:11434"


# ---------------------------------------------------------------------------
# Low-level HTTP calls to the Ollama REST API
# ---------------------------------------------------------------------------

def _check_ollama_running(host: str = OLLAMA_HOST) -> bool:
    """Return True if the Ollama server is reachable."""
    try:
        r = requests.get(f"{host}/api/tags", timeout=5)
        return r.status_code == 200
    except requests.ConnectionError:
        return False
    except Exception:
        return False


def _stream_generate(
    model: str,
    prompt: str,
    host: str = OLLAMA_HOST,
    system: Optional[str] = None,
) -> str:
    """
    Call the Ollama /api/generate endpoint with streaming enabled.
    Returns the full concatenated response text.
    """
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": True,
    }
    if system:
        payload["system"] = system

    url = f"{host}/api/generate"
    full_response = []

    try:
        with requests.post(url, json=payload, stream=True, timeout=300) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    full_response.append(token)
                    if chunk.get("done"):
                        break
    except requests.ConnectionError:
        return (
            "[OLLAMA ERROR] Cannot connect to Ollama. "
            "Make sure 'ollama serve' is running in another terminal."
        )
    except requests.Timeout:
        return "[OLLAMA ERROR] Request timed out after 300 s."
    except requests.HTTPError as e:
        return f"[OLLAMA ERROR] HTTP {e.response.status_code}: {e.response.text[:300]}"
    except Exception as exc:
        return f"[OLLAMA ERROR] Unexpected error: {exc}"

    return "".join(full_response).strip()


# ---------------------------------------------------------------------------
# System prompt (mirrors sudarshan-instructions.md philosophy)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = textwrap.dedent("""\
    You are Sudarshan, a hands-on cybersecurity research and bug bounty analyst.
    You only work with real tool output — you never invent or fabricate findings.
    Your job is to:
    1. Identify actual security issues in the raw tool output.
    2. Map each finding to an OWASP Top 10 (2021) category.
    3. Assign a severity: Critical / High / Medium / Low / Informational.
    4. Briefly explain the evidence from the output.
    5. Suggest a concrete remediation step.
    6. Flag anything that looks like a false positive and explain why.
    If the tool output contains no findings, say so explicitly — do not invent issues.
    Be concise and precise. No hype language. Every claim must be backed by the output.
""")


# ---------------------------------------------------------------------------
# Per-tool analysis prompts
# ---------------------------------------------------------------------------

def _build_prompt(tool_name: str, target: str, raw_output: str) -> str:
    truncated = raw_output[:MAX_CHARS]
    if len(raw_output) > MAX_CHARS:
        truncated += f"\n\n[... output truncated at {MAX_CHARS} chars ...]"

    return textwrap.dedent(f"""\
        Target: {target}
        Tool: {tool_name}

        === RAW TOOL OUTPUT ===
        {truncated}
        === END OF OUTPUT ===

        Analyze the output above. Identify security findings, map them to OWASP Top 10 (2021),
        assign severity, cite the specific evidence, and suggest remediation.
        If there are no real findings, state that clearly.
    """)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze(
    tool_name: str,
    raw_output: str,
    target: str,
    model: str,
    host: str = OLLAMA_HOST,
) -> str:
    """
    Send *raw_output* from *tool_name* to the local Ollama model.
    Returns the model's structured analysis as a string.
    """
    if raw_output.startswith("[NOT INSTALLED]") or raw_output.startswith("N/A"):
        return f"(skipped — tool not available: {raw_output})"

    if not _check_ollama_running(host):
        return (
            "[OLLAMA ERROR] Ollama is not running. "
            "Start it with: ollama serve"
        )

    console.print(f"[magenta]  → Sending {tool_name} output to {model} for analysis ...[/magenta]")
    prompt = _build_prompt(tool_name, target, raw_output)
    response = _stream_generate(model=model, prompt=prompt, host=host, system=SYSTEM_PROMPT)
    return response


def analyze_all(
    scan_results: dict,
    target: str,
    model: str,
    host: str = OLLAMA_HOST,
) -> dict:
    """
    Iterate over all tool results in *scan_results* and request AI analysis
    for each one.

    scan_results: {"tool_name": "raw output string", ...}
    Returns:      {"tool_name": "AI analysis string", ...}
    """
    analyses: dict = {}
    for tool_name, raw_output in scan_results.items():
        console.print(f"\n[bold magenta][AI ANALYSIS] {tool_name}[/bold magenta]")
        analyses[tool_name] = analyze(
            tool_name=tool_name,
            raw_output=raw_output,
            target=target,
            model=model,
            host=host,
        )
    return analyses


def executive_summary(
    all_analyses: dict,
    target: str,
    model: str,
    host: str = OLLAMA_HOST,
) -> str:
    """
    Ask the model to produce a consolidated Executive Summary across all
    tool analyses.
    """
    if not _check_ollama_running(host):
        return "[OLLAMA ERROR] Ollama is not running."

    combined = "\n\n".join(
        f"=== {tool} ===\n{analysis}"
        for tool, analysis in all_analyses.items()
        if not analysis.startswith("(skipped")
    )
    combined = combined[:MAX_CHARS]

    prompt = textwrap.dedent(f"""\
        Target: {target}

        Below are individual tool analyses from a security scan.
        Write a concise Executive Summary (max 400 words) that:
        - Lists the top 3-5 most critical findings, prioritized by severity.
        - Notes which OWASP categories were affected.
        - Recommends the single most impactful remediation step.
        - States which findings still need manual verification.

        === TOOL ANALYSES ===
        {combined}
        === END ===
    """)

    console.print("\n[bold magenta][AI] Generating Executive Summary ...[/bold magenta]")
    return _stream_generate(model=model, prompt=prompt, host=host, system=SYSTEM_PROMPT)
