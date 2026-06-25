#!/usr/bin/env python3
"""
OWASP Benchmark Runner
======================
Evaluates CodeGuard AI scanner accuracy against the OWASP Benchmark test suite.

Usage:
  python -m app.benchmark.benchmark_runner \\
      --scan-dir  /path/to/BenchmarkJava/src \\
      --expected  /path/to/expectedresults-1.2.csv \\
      [--output   results.json]

  # Quick self-test with built-in fixture:
  python -m app.benchmark.benchmark_runner --test-run

OWASP Benchmark expectedresults CSV format:
  # test name,real vulnerability,CWE,category
  BenchmarkTest00001,true,89,SQL Injection
  BenchmarkTest00002,false,89,SQL Injection
  ...

Metrics:
  TP  – scanner flagged a vulnerability, ground truth = true
  FP  – scanner flagged a vulnerability, ground truth = false
  FN  – scanner missed a vulnerability, ground truth = true
  TN  – scanner correctly ignored, ground truth = false
  Precision = TP / (TP + FP)
  Recall    = TP / (TP + FN)
  F1        = 2 * Precision * Recall / (Precision + Recall)
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple


# ---------------------------------------------------------------------------
# Ground-truth record
# ---------------------------------------------------------------------------

class GroundTruth(NamedTuple):
    test_case_id: str   # e.g. "BenchmarkTest00001"
    is_vulnerable: bool
    cwe_id: str         # e.g. "CWE-89"
    category: str       # e.g. "SQL Injection"


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _normalise_cwe(raw: str) -> str:
    """Normalise CWE strings to 'CWE-NNN' format."""
    raw = raw.strip()
    if raw.upper().startswith("CWE-"):
        return raw.upper()
    if raw.isdigit():
        return f"CWE-{raw}"
    m = re.search(r"\d+", raw)
    return f"CWE-{m.group()}" if m else raw.upper()


def _test_case_id_from_path(file_path: str) -> str | None:
    """Extract test case ID from a file path like 'BenchmarkTest00001.java'."""
    m = re.search(r"(BenchmarkTest\d+)", file_path, re.IGNORECASE)
    return m.group(1) if m else None


def load_expected_results(csv_path: Path) -> list[GroundTruth]:
    """Parse the OWASP Benchmark expectedresults CSV."""
    results: list[GroundTruth] = []
    with csv_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.reader(fh):
            if not row or row[0].startswith("#"):
                continue
            if len(row) < 3:
                continue
            test_id = row[0].strip()
            is_vuln = row[1].strip().lower() == "true"
            cwe_raw = row[2].strip() if len(row) > 2 else ""
            category = row[3].strip() if len(row) > 3 else ""
            results.append(GroundTruth(
                test_case_id=test_id,
                is_vulnerable=is_vuln,
                cwe_id=_normalise_cwe(cwe_raw),
                category=category,
            ))
    return results


# ---------------------------------------------------------------------------
# Scanner invocation
# ---------------------------------------------------------------------------

def run_scanner_on_dir(scan_dir: Path):
    """Run the hybrid scanner and return findings."""
    # We import here to avoid circular import at module load time
    from app.services.scanner_orchestrator import run_hybrid_scan
    findings, _, _, _, _ = run_hybrid_scan(scan_dir)
    return findings


# ---------------------------------------------------------------------------
# Matching logic
# ---------------------------------------------------------------------------

def _findings_by_test_case(findings) -> dict[str, list]:
    """Group findings by test case ID extracted from file_path."""
    grouped: dict[str, list] = defaultdict(list)
    for f in findings:
        tc_id = _test_case_id_from_path(f.file_path)
        if tc_id:
            grouped[tc_id.upper()].append(f)
    return dict(grouped)


def _finding_matches_cwe(finding, expected_cwe: str) -> bool:
    """Return True if the finding's CWE matches the expected CWE."""
    finding_cwe = _normalise_cwe(getattr(finding, "cwe_id", "") or "")
    return finding_cwe == expected_cwe


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------

class BenchmarkResult(NamedTuple):
    cwe: str
    category: str
    tp: int
    fp: int
    fn: int
    tn: int
    precision: float
    recall: float
    f1: float
    total: int


def compute_metrics(
    ground_truths: list[GroundTruth],
    findings_by_tc: dict[str, list],
) -> tuple[list[BenchmarkResult], BenchmarkResult]:
    """
    Compute per-CWE metrics and an overall aggregate result.

    Matching logic:
      - A finding is a match if its test_case_id AND CWE align with a ground-truth entry.
      - If the scanner finds any matching-CWE finding for a vulnerable test case → TP.
      - If the scanner finds matching-CWE finding for a safe test case → FP.
      - If the scanner misses a vulnerable test case → FN.
      - If the scanner correctly ignores a safe test case → TN.
    """
    # Group ground truths by CWE
    by_cwe: dict[str, list[GroundTruth]] = defaultdict(list)
    for gt in ground_truths:
        by_cwe[gt.cwe_id].append(gt)

    per_cwe_results: list[BenchmarkResult] = []
    overall_tp = overall_fp = overall_fn = overall_tn = 0

    for cwe, gts in sorted(by_cwe.items()):
        tp = fp = fn = tn = 0
        for gt in gts:
            tc_id = gt.test_case_id.upper()
            tc_findings = findings_by_tc.get(tc_id, [])
            has_match = any(_finding_matches_cwe(f, cwe) for f in tc_findings)

            if gt.is_vulnerable:
                if has_match:
                    tp += 1
                else:
                    fn += 1
            else:
                if has_match:
                    fp += 1
                else:
                    tn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        category = gts[0].category if gts else cwe
        per_cwe_results.append(BenchmarkResult(
            cwe=cwe, category=category,
            tp=tp, fp=fp, fn=fn, tn=tn,
            precision=precision, recall=recall, f1=f1,
            total=len(gts),
        ))

        overall_tp += tp
        overall_fp += fp
        overall_fn += fn
        overall_tn += tn

    overall_precision = overall_tp / (overall_tp + overall_fp) if (overall_tp + overall_fp) > 0 else 0.0
    overall_recall = overall_tp / (overall_tp + overall_fn) if (overall_tp + overall_fn) > 0 else 0.0
    overall_f1 = (
        (2 * overall_precision * overall_recall / (overall_precision + overall_recall))
        if (overall_precision + overall_recall) > 0 else 0.0
    )

    overall = BenchmarkResult(
        cwe="ALL", category="Overall",
        tp=overall_tp, fp=overall_fp, fn=overall_fn, tn=overall_tn,
        precision=overall_precision, recall=overall_recall, f1=overall_f1,
        total=len(ground_truths),
    )

    return per_cwe_results, overall


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def print_report(per_cwe: list[BenchmarkResult], overall: BenchmarkResult) -> None:
    header = (
        f"\n{'CWE':<12} {'Category':<30} {'TP':>5} {'FP':>5} {'FN':>5} {'TN':>5} "
        f"{'Precision':>10} {'Recall':>8} {'F1':>8} {'Total':>7}"
    )
    sep = "-" * len(header)
    print(header)
    print(sep)
    for r in per_cwe:
        print(
            f"{r.cwe:<12} {r.category[:30]:<30} {r.tp:>5} {r.fp:>5} {r.fn:>5} {r.tn:>5} "
            f"{r.precision:>10.1%} {r.recall:>8.1%} {r.f1:>8.1%} {r.total:>7}"
        )
    print(sep)
    print(
        f"{'OVERALL':<12} {overall.category[:30]:<30} {overall.tp:>5} {overall.fp:>5} "
        f"{overall.fn:>5} {overall.tn:>5} "
        f"{overall.precision:>10.1%} {overall.recall:>8.1%} {overall.f1:>8.1%} {overall.total:>7}"
    )
    print()


# ---------------------------------------------------------------------------
# Self-test fixture
# ---------------------------------------------------------------------------

_FIXTURE_CSV = """\
# test name,real vulnerability,CWE,category
BenchmarkTest00001,true,89,SQL Injection
BenchmarkTest00002,false,89,SQL Injection
BenchmarkTest00003,true,78,OS Command Injection
BenchmarkTest00004,false,22,Path Traversal
BenchmarkTest00005,true,22,Path Traversal
"""

_FIXTURE_CODE = {
    "BenchmarkTest00001.java": (
        "import javax.servlet.http.*;\n"
        "public class BenchmarkTest00001 {\n"
        "  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws Exception {\n"
        "    String id = req.getParameter(\"id\");\n"
        "    java.sql.Statement stmt = null;\n"
        "    stmt.executeQuery(\"SELECT * FROM users WHERE id='\" + id + \"'\");\n"
        "  }\n"
        "}\n"
    ),
    "BenchmarkTest00002.java": (
        "public class BenchmarkTest00002 {\n"
        "  public void doGet() {\n"
        "    java.sql.PreparedStatement ps = null;\n"
        "    // safe – uses parameterised query\n"
        "  }\n"
        "}\n"
    ),
    "BenchmarkTest00003.java": (
        "import javax.servlet.http.*;\n"
        "public class BenchmarkTest00003 {\n"
        "  public void doGet(HttpServletRequest req) throws Exception {\n"
        "    String cmd = req.getParameter(\"cmd\");\n"
        "    Runtime.getRuntime().exec(cmd);\n"
        "  }\n"
        "}\n"
    ),
    "BenchmarkTest00004.java": (
        "public class BenchmarkTest00004 {\n"
        "  public void readFile(String safePath) throws Exception {\n"
        "    new java.io.File(\"/data/\" + safePath).getCanonicalPath();\n"
        "  }\n"
        "}\n"
    ),
    "BenchmarkTest00005.java": (
        "import javax.servlet.http.*;\n"
        "public class BenchmarkTest00005 {\n"
        "  public void doGet(HttpServletRequest req) throws Exception {\n"
        "    String path = req.getParameter(\"path\");\n"
        "    new java.io.FileInputStream(path);\n"
        "  }\n"
        "}\n"
    ),
}


def run_test_fixture() -> None:
    """Run the benchmark on a small built-in fixture to verify the pipeline."""
    print("Running self-test fixture ...\n")

    with tempfile.TemporaryDirectory() as tmpdir:
        scan_dir = Path(tmpdir) / "src"
        scan_dir.mkdir()

        # Write fixture source files
        for fname, code in _FIXTURE_CODE.items():
            (scan_dir / fname).write_text(code, encoding="utf-8")

        # Write fixture expected results CSV
        csv_path = Path(tmpdir) / "expectedresults.csv"
        csv_path.write_text(_FIXTURE_CSV, encoding="utf-8")

        ground_truths = load_expected_results(csv_path)
        findings = run_scanner_on_dir(scan_dir)

        print(f"Ground-truth entries : {len(ground_truths)}")
        print(f"Scanner findings     : {len(findings)}\n")

        findings_by_tc = _findings_by_test_case(findings)
        per_cwe, overall = compute_metrics(ground_truths, findings_by_tc)
        print_report(per_cwe, overall)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CodeGuard AI – OWASP Benchmark Accuracy Evaluation"
    )
    parser.add_argument("--scan-dir", type=Path, help="Path to benchmark source directory")
    parser.add_argument("--expected", type=Path, help="Path to expectedresults CSV file")
    parser.add_argument("--output", type=Path, help="Optional JSON output file")
    parser.add_argument(
        "--test-run", action="store_true",
        help="Run a quick self-test with the built-in fixture (no files needed)"
    )
    args = parser.parse_args()

    if args.test_run:
        run_test_fixture()
        return

    if not args.scan_dir or not args.expected:
        parser.error("--scan-dir and --expected are required (or use --test-run)")

    if not args.scan_dir.is_dir():
        print(f"ERROR: --scan-dir '{args.scan_dir}' is not a directory", file=sys.stderr)
        sys.exit(1)
    if not args.expected.is_file():
        print(f"ERROR: --expected '{args.expected}' not found", file=sys.stderr)
        sys.exit(1)

    print(f"Loading ground truth from: {args.expected}")
    ground_truths = load_expected_results(args.expected)
    print(f"Ground-truth entries: {len(ground_truths)}\n")

    print(f"Running scanner on: {args.scan_dir}")
    findings = run_scanner_on_dir(args.scan_dir)
    print(f"Scanner findings   : {len(findings)}\n")

    findings_by_tc = _findings_by_test_case(findings)
    per_cwe, overall = compute_metrics(ground_truths, findings_by_tc)
    print_report(per_cwe, overall)

    if args.output:
        report = {
            "overall": overall._asdict(),
            "per_cwe": [r._asdict() for r in per_cwe],
        }
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"JSON report written to: {args.output}")


if __name__ == "__main__":
    main()
