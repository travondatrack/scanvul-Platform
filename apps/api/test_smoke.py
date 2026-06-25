import sys, tempfile, shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

tmpdir = Path(tempfile.mkdtemp())
src = tmpdir / "test.py"
src.write_text(
    'import os\n'
    'password = "hardcoded_abc123XYZ"\n'
    'os.system(input())\n'
)

from app.services.scanner_orchestrator import run_hybrid_scan

findings, langs, fws, risk, pct = run_hybrid_scan(tmpdir)
print(f"Findings: {len(findings)}  Risk: {risk} ({pct:.1f}%)")
for f in findings[:5]:
    print(f"  [{f.severity}] {f.engine}: {f.title[:55]}")
    print(f"       status={f.verification_status} hash={f.dedupe_hash[:10]}")
    if f.evidence:
        print(f"       evidence={f.evidence[:40]!r}")

shutil.rmtree(tmpdir)
print("Done.")
