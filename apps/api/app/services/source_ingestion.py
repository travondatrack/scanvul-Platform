from __future__ import annotations

import json
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path

from app.core.config import settings
from app.models.scan import UploadedAsset
from app.services.storage import get_s3_client


def _safe_extract_zip(archive_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive_path) as zf:
        for member in zf.infolist():
            target = destination / member.filename
            if not str(target.resolve()).startswith(str(destination.resolve())):
                raise ValueError("Unsafe archive path detected")
        zf.extractall(destination)


def _safe_extract_tar(archive_path: Path, destination: Path) -> None:
    with tarfile.open(archive_path) as tf:
        for member in tf.getmembers():
            target = destination / member.name
            if not str(target.resolve()).startswith(str(destination.resolve())):
                raise ValueError("Unsafe archive path detected")
        tf.extractall(destination)


def _clone_public_repo(repo_url: str, destination: Path) -> None:
    subprocess.run(
        ["git", "clone", "--depth", "1", repo_url, str(destination)],
        check=True,
        capture_output=True,
        text=True,
    )


def _materialize_pasted_files(serialized: str, destination: Path) -> None:
    payload = json.loads(serialized)
    files = payload.get("files", payload if isinstance(payload, list) else [])
    if not isinstance(files, list):
        raise ValueError("Paste payload must be a list or {files: []}")

    for item in files:
        path = item.get("path")
        content = item.get("content", "")
        if not path:
            continue
        target = destination / path
        if not str(target.resolve()).startswith(str(destination.resolve())):
            raise ValueError("Unsafe file path in pasted input")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def _download_uploaded_archive(upload_asset: UploadedAsset, destination: Path) -> Path:
    local_path = destination / upload_asset.file_name
    client = get_s3_client()
    client.download_file(settings.minio_bucket, upload_asset.object_key, str(local_path))
    return local_path


def ingest_source(source_type: str, source_value: str, upload_asset: UploadedAsset | None = None) -> Path:
    workspace = Path(tempfile.mkdtemp(prefix="codeguard-scan-"))
    target = workspace / "source"
    target.mkdir(parents=True, exist_ok=True)

    if source_type == "repo_url":
        _clone_public_repo(source_value, target)
    elif source_type == "archive":
        if upload_asset is None:
            raise ValueError("Archive scans require uploaded asset")
        archive = _download_uploaded_archive(upload_asset, workspace)
        if archive.suffix.lower() == ".zip":
            _safe_extract_zip(archive, target)
        elif archive.suffix.lower() in {".gz", ".tgz"} or archive.name.endswith(".tar.gz"):
            _safe_extract_tar(archive, target)
        else:
            raise ValueError("Unsupported archive format")
    elif source_type == "paste":
        _materialize_pasted_files(source_value, target)
    else:
        raise ValueError("Unsupported source type")

    return target


def cleanup_source(path: Path) -> None:
    root = path.parent if path.name == "source" else path
    shutil.rmtree(root, ignore_errors=True)
