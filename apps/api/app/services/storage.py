from __future__ import annotations

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


def ensure_bucket_exists() -> None:
    client = get_s3_client()
    bucket = settings.minio_bucket
    try:
        existing = [item["Name"] for item in client.list_buckets().get("Buckets", [])]
        if bucket not in existing:
            client.create_bucket(Bucket=bucket)
    except Exception:
        # Worker and API can continue; bucket provisioning can be retried on demand.
        return
