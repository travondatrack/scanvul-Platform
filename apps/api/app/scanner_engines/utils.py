from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_command(args: list[str], cwd: Path, timeout: int = 600) -> tuple[int, str, str]:
    proc = subprocess.run(
        args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    return proc.returncode, proc.stdout, proc.stderr


def parse_json_output(raw: str) -> dict:
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
