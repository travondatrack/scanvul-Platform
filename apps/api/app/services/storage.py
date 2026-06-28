from __future__ import annotations

import shutil
from pathlib import Path

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.core.config import settings


_s3_client: BaseClient | None = None


def get_s3_client() -> BaseClient:
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _s3_client


def _local_object_path(object_key: str) -> Path:
    root = Path(settings.local_storage_path).resolve()
    path = (root / object_key).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ValueError("Unsafe object key") from exc
    return path


def is_local_storage() -> bool:
    return settings.storage_backend.lower() == "local"


def create_upload_url(object_key: str) -> str:
    if is_local_storage():
        return f"/api/v1/uploads/{object_key}/data"

    client = get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.minio_bucket,
            "Key": object_key,
            "ContentType": "application/octet-stream",
        },
        ExpiresIn=settings.presigned_upload_expiry_seconds,
    )


def put_object(object_key: str, content: bytes, content_type: str = "application/octet-stream") -> None:
    if is_local_storage():
        path = _local_object_path(object_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return

    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket,
        Key=object_key,
        Body=content,
        ContentType=content_type,
    )


def object_exists(object_key: str) -> bool:
    if is_local_storage():
        return _local_object_path(object_key).is_file()

    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.minio_bucket, Key=object_key)
        return True
    except Exception:
        return False


def download_object(object_key: str, destination: Path) -> None:
    if is_local_storage():
        shutil.copyfile(_local_object_path(object_key), destination)
        return

    client = get_s3_client()
    client.download_file(settings.minio_bucket, object_key, str(destination))


def ensure_bucket_exists() -> None:
    if is_local_storage():
        Path(settings.local_storage_path).mkdir(parents=True, exist_ok=True)
        return

    client = get_s3_client()
    bucket = settings.minio_bucket
    try:
        existing = [item["Name"] for item in client.list_buckets().get("Buckets", [])]
        if bucket not in existing:
            client.create_bucket(Bucket=bucket)
    except Exception:
        # Worker and API can continue; bucket provisioning can be retried on demand.
        return
