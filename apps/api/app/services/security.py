from __future__ import annotations

import httpx
from fastapi import Header, HTTPException

from app.core.config import settings


async def validate_captcha(x_captcha_token: str | None = Header(default=None)) -> None:
    if not settings.captcha_secret_key:
        return
    if not x_captcha_token:
        raise HTTPException(status_code=400, detail="Missing CAPTCHA token")

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                "secret": settings.captcha_secret_key,
                "response": x_captcha_token,
            },
        )
    if not response.is_success or not response.json().get("success", False):
        raise HTTPException(status_code=400, detail="Invalid CAPTCHA token")
