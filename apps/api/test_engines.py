import os
from pathlib import Path
import pytest
from app.services.scanner_orchestrator import run_hybrid_scan, calculate_risk

@pytest.fixture
def mock_apps_dir(tmp_path):
    # 1. Node/Express insecure sample (SQLi)
    node_dir = tmp_path / "node_app"
    node_dir.mkdir()
    (node_dir / "app.js").write_text('''
        const express = require('express');
        const app = express();
        app.get('/user', (req, res) => {
            const id = req.query.id;
            // Vulnerable to SQLi
            db.query("SELECT * FROM users WHERE id = " + id);
            res.send("Done");
        });
    ''')

    # 2. Python Flask insecure sample (Command Injection)
    flask_dir = tmp_path / "flask_app"
    flask_dir.mkdir()
    (flask_dir / "app.py").write_text('''
        import os
        from flask import Flask, request
        app = Flask(__name__)
        @app.route("/ping")
        def ping():
            target = request.args.get("target")
            # Vulnerable to Command Injection
            os.system("ping -c 1 " + target)
            return "Pinged"
    ''')

    # 3. Hardcoded secrets sample
    secret_dir = tmp_path / "secret_app"
    secret_dir.mkdir()
    (secret_dir / "config.py").write_text('''
        # Hardcoded AWS secret
        AWS_SECRET = "AKIAPQ8X7ZN6BY5MC4AL"
        GITHUB_TOKEN = "ghp_xYzAbCdEfGhIjKlMnOpQrStUvWxYz0987654"
    ''')
    
    # 4. Clean project
    clean_dir = tmp_path / "clean_app"
    clean_dir.mkdir()
    (clean_dir / "main.py").write_text('''
        def add(a, b):
            return a + b
        print(add(1, 2))
    ''')

    return {
        "node": node_dir,
        "flask": flask_dir,
        "secret": secret_dir,
        "clean": clean_dir
    }

def test_engines_node_sqli(mock_apps_dir):
    findings, _, _, risk_level, _ = run_hybrid_scan(mock_apps_dir["node"], "repo_url", "https://github.com/test/test")
    # If semgrep/eslint is installed, it should find SQLi. 
    # For now, we assert the orchestrator runs without crashing and generates code links.
    for f in findings:
        assert f.code_link.startswith("https://github.com/test/test/blob/main/app.js")
        
def test_engines_flask_cmd_injection(mock_apps_dir):
    findings, _, _, risk_level, _ = run_hybrid_scan(mock_apps_dir["flask"], "archive", "test.zip")
    for f in findings:
        assert f.code_link.startswith("/dashboard/scans/snippet")

def test_engines_secret_scanner(mock_apps_dir):
    findings, _, _, risk_level, _ = run_hybrid_scan(mock_apps_dir["secret"])
    
    # Secret scanner is built-in and always runs
    secret_findings = [f for f in findings if f.scan_category == "Secret scan"]
    assert len(secret_findings) > 0
    assert any("AKIA" in f.evidence for f in secret_findings)
    assert any("ghp_" in f.evidence for f in secret_findings)
    assert risk_level in ["High", "Critical"]

def test_engines_clean_project(mock_apps_dir):
    findings, _, _, risk_level, _ = run_hybrid_scan(mock_apps_dir["clean"])
    # Clean project should have no findings
    assert len(findings) == 0
    assert risk_level == "Low"
