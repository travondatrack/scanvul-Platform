from __future__ import annotations

import json
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
import urllib.parse
import socket
import ipaddress
from pathlib import Path

from app.core.config import settings
from app.models.scan import UploadedAsset
from app.services.storage import download_object

MAX_EXTRACT_SIZE = 500 * 1024 * 1024  # 500 MB
MAX_FILES = 20000


def _ensure_within_directory(path: Path, root: Path, message: str) -> Path:
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError(message) from exc
    return resolved_path


# ─── Whitelist helper ────────────────────────────────────────────────────────

def _allowed_prefixes() -> list[str]:
    """Return the list of allowed repo URL prefixes from settings."""
    return [p.strip() for p in settings.allowed_repo_url_prefixes.split(",") if p.strip()]


def validate_repo_url(url: str) -> None:
    """Raise ValueError if the URL is not valid or vulnerable to SSRF."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Repo URL must use HTTPS scheme")
    
    if not parsed.hostname:
        raise ValueError("Invalid Repo URL hostname")
        
    try:
        ip = socket.gethostbyname(parsed.hostname)
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_multicast or ip_obj.is_reserved:
            raise ValueError("Repo URL resolves to a private or internal IP address (SSRF protection)")
    except socket.gaierror:
        raise ValueError("Repo URL hostname could not be resolved")
        
    if not any(url.startswith(prefix) for prefix in _allowed_prefixes()):
        allowed = ", ".join(_allowed_prefixes())
        raise ValueError(f"Repo URL must start with one of: {allowed}")


# ─── Extraction helpers ──────────────────────────────────────────────────────

def _safe_extract_zip(archive_path: Path, destination: Path) -> None:
    extracted_size = 0
    extracted_count = 0
    with zipfile.ZipFile(archive_path) as zf:
        for member in zf.infolist():
            target = destination / member.filename
            _ensure_within_directory(target, destination, "Unsafe archive path detected (zip path traversal)")
            mode = member.external_attr >> 16
            if (mode & 0o170000) == 0o120000:
                raise ValueError("Unsafe archive member detected")
            
            extracted_size += member.file_size
            extracted_count += 1
            if extracted_size > MAX_EXTRACT_SIZE:
                raise ValueError("Archive exceeds maximum extraction size limit")
            if extracted_count > MAX_FILES:
                raise ValueError("Archive exceeds maximum file count limit")
                
            zf.extract(member, destination)


def _safe_extract_tar(archive_path: Path, destination: Path) -> None:
    extracted_size = 0
    extracted_count = 0
    with tarfile.open(archive_path) as tf:
        for member in tf.getmembers():
            target = destination / member.name
            _ensure_within_directory(target, destination, "Unsafe archive path detected (tar path traversal)")
            if member.issym() or member.islnk() or member.isdev():
                raise ValueError("Unsafe archive member detected")
                
            extracted_size += member.size
            extracted_count += 1
            if extracted_size > MAX_EXTRACT_SIZE:
                raise ValueError("Archive exceeds maximum extraction size limit")
            if extracted_count > MAX_FILES:
                raise ValueError("Archive exceeds maximum file count limit")
                
            tf.extract(member, destination)


def _clone_public_repo(repo_url: str, destination: Path) -> None:
    """
    Clone a public git repository with a configurable timeout.
    Raises subprocess.TimeoutExpired if the clone takes too long.
    """
    timeout = settings.git_clone_timeout_seconds
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(destination)],
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(
            f"git clone exceeded {timeout}s timeout for URL: {repo_url}"
        ) from exc


def _materialize_pasted_files(serialized: str, destination: Path) -> None:
    payload = json.loads(serialized)
    files = payload if isinstance(payload, list) else payload.get("files", [])
    if not isinstance(files, list):
        raise ValueError("Paste payload must be a list or {files: []}")

    for item in files:
        path = item.get("path")
        content = item.get("content", "")
        if not path:
            continue
        target = destination / path
        _ensure_within_directory(target, destination, "Unsafe file path in pasted input (path traversal)")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def _download_uploaded_archive(upload_asset: UploadedAsset, destination: Path) -> Path:
    local_path = destination / upload_asset.file_name
    download_object(upload_asset.object_key, local_path)
    return local_path


# ─── Public API ──────────────────────────────────────────────────────────────

def ingest_source(
    source_type: str,
    source_value: str,
    upload_asset: UploadedAsset | None = None,
) -> Path:
    """
    Prepare a temporary source directory for scanning.

    Returns the path to the extracted/materialized source directory.
    The caller is responsible for calling cleanup_source() when done.
    """
    workspace = Path(tempfile.mkdtemp(prefix="scanvul-scan-"))
    target = workspace / "source"
    target.mkdir(parents=True, exist_ok=True)

    if source_type == "repo_url":
        # Validate URL against whitelist before cloning
        validate_repo_url(source_value)
        _clone_public_repo(source_value, target)
    elif source_type == "archive":
        if upload_asset is None:
            raise ValueError("Archive scans require an uploaded asset")
        archive = _download_uploaded_archive(upload_asset, workspace)
        suffix = archive.suffix.lower()
        if suffix == ".zip":
            _safe_extract_zip(archive, target)
        elif suffix in {".gz", ".tgz"} or archive.name.endswith(".tar.gz"):
            _safe_extract_tar(archive, target)
        else:
            raise ValueError("Unsupported archive format (only .zip and .tar.gz)")
    elif source_type == "paste":
        _materialize_pasted_files(source_value, target)
    else:
        raise ValueError(f"Unsupported source type: {source_type!r}")

    return target


def cleanup_source(path: Path) -> None:
    """Remove the temporary workspace directory created by ingest_source."""
    root = path.parent if path.name == "source" else path
    shutil.rmtree(root, ignore_errors=True)
