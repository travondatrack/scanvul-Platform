from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_value: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    risk_level: Mapped[str] = mapped_column(String(20), default="Unknown")
    risk_percent: Mapped[float] = mapped_column(Float, default=0.0)
    language_summary: Mapped[str] = mapped_column(Text, default="{}")
    framework_summary: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    findings: Mapped[list["Finding"]] = relationship(back_populates="scan", cascade="all,delete-orphan")
    badges: Mapped[list["PublicBadge"]] = relationship(back_populates="scan", cascade="all,delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False)

    # ── Core identity ──────────────────────────────────────────────────────────
    engine: Mapped[str] = mapped_column(String(40), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(120), default="")
    scan_category: Mapped[str] = mapped_column(String(40), default="SAST source code")
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    vuln_type: Mapped[str] = mapped_column(String(120), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    cvss4_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    cwe_id: Mapped[str] = mapped_column(String(20), default="")
    owasp_category: Mapped[str] = mapped_column(String(80), default="")

    # ── Location ───────────────────────────────────────────────────────────────
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, default=1)   # backward-compat alias
    line_start: Mapped[int] = mapped_column(Integer, default=1)
    line_end: Mapped[int] = mapped_column(Integer, default=1)

    # ── Dataflow ──────────────────────────────────────────────────────────────
    source: Mapped[str] = mapped_column(Text, default="")
    sink: Mapped[str] = mapped_column(Text, default="")
    function_name: Mapped[str] = mapped_column(String(160), default="")
    dataflow_trace: Mapped[str] = mapped_column(Text, default="")   # JSON trace steps

    # ── Evidence & explanation ─────────────────────────────────────────────────
    # evidence contains only redacted/masked values – never raw credentials
    evidence: Mapped[str] = mapped_column(Text, default="")
    code_snippet: Mapped[str] = mapped_column(Text, default="")
    why_vulnerable: Mapped[str] = mapped_column(Text, default="")
    attack_scenario: Mapped[str] = mapped_column(Text, default="")
    impact: Mapped[str] = mapped_column(Text, default="")
    poc: Mapped[str] = mapped_column(Text, default="")
    remediation: Mapped[str] = mapped_column(Text, default="")
    secure_example: Mapped[str] = mapped_column(Text, default="")
    pentest_hint: Mapped[str] = mapped_column(Text, default="")
    references: Mapped[str] = mapped_column("ext_references", Text, default="")

    # ── Triage & verification ─────────────────────────────────────────────────
    # verification_status: unverified|verified|failed|skipped|needs_review|false_positive_likely
    verification_status: Mapped[str] = mapped_column(String(40), default="unverified")
    dedupe_hash: Mapped[str] = mapped_column(String(64), default="")

    scan: Mapped[Scan] = relationship(back_populates="findings")


class UploadedAsset(Base):
    __tablename__ = "uploaded_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="initialized")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PublicBadge(Base):
    __tablename__ = "public_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=lambda: str(uuid4()).replace("-", ""))
    is_active: Mapped[str] = mapped_column(String(5), default="true")
    expires_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=30))

    scan: Mapped[Scan] = relationship(back_populates="badges")
