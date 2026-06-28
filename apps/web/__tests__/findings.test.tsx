/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { FindingsPanel } from "@/components/ui/findings-panel";
import { jest } from "@jest/globals";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      refresh: jest.fn(),
    };
  },
}));

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })
  ) as any;
});

const mockFindings = [
  {
    id: "finding-1",
    status: "open",
    assigneeId: undefined,
    severity: "Critical",
    ruleId: "RULE-001",
    scanCategory: "SAST",
    engine: "semgrep",
    title: "SQL Injection found in login endpoint",
    filePath: "src/auth/login.ts",
    lineNumber: 45,
    lineStart: 45,
    lineEnd: 45,
    source: "req.body.username",
    sink: "db.query()",
    functionName: "login",
    whyVulnerable: "User input is directly concatenated into SQL query.",
    attackScenario: "Attacker can bypass auth.",
    impact: "Full database compromise.",
    remediation: "Use parameterized queries.",
    poc: "' OR 1=1 --",
    codeSnippet: "db.query(`SELECT * FROM users WHERE username = '${req.body.username}'`)",
    evidence: "Found unparameterized query.",
    pentestHint: "1. Try sending `' OR 1=1 --` as username.",
    references: "https://owasp.org/...",
    cvss4: 9.8,
    confidence: 0.95,
    verificationStatus: "verified",
    dedupeHash: "hash1",
    dataflowTrace: "",
    vulnType: "SQLi",
    cweId: "CWE-89",
    owaspCategory: "A03:2021-Injection",
  },
  {
    id: "finding-2",
    status: "open",
    assigneeId: undefined,
    severity: "Low",
    ruleId: "RULE-002",
    scanCategory: "Secret",
    engine: "trivy",
    title: "Hardcoded AWS Key",
    filePath: "config/aws.ts",
    lineNumber: 12,
    lineStart: 12,
    lineEnd: 12,
    source: "",
    sink: "",
    functionName: "",
    whyVulnerable: "Secret in code.",
    attackScenario: "",
    impact: "AWS account compromise.",
    remediation: "Use environment variables.",
    poc: "",
    codeSnippet: "const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'",
    evidence: "",
    pentestHint: "",
    references: "",
    cvss4: 3.5,
    confidence: 1.0,
    verificationStatus: "unverified",
    dedupeHash: "hash2",
    dataflowTrace: "",
    vulnType: "Secret",
    cweId: "CWE-798",
    owaspCategory: "A07:2021-Identification and Authentication Failures",
  }
];

describe("FindingsPanel", () => {
  test("renders all findings initially", () => {
    render(<FindingsPanel findings={mockFindings} />);
    
    // Check titles
    expect(screen.getByText("SQL Injection found in login endpoint")).toBeDefined();
    expect(screen.getByText("Hardcoded AWS Key")).toBeDefined();
    
    // Check counts
    expect(screen.getByText("Showing 2 of 2")).toBeDefined();
  });

  test("filters findings by severity", () => {
    render(<FindingsPanel findings={mockFindings} />);
    
    // Find the severity select
    const selects = screen.getAllByRole("combobox");
    // Severity is the first select
    const severitySelect = selects[0];
    
    // Change to Critical
    fireEvent.change(severitySelect, { target: { value: "Critical" } });
    
    expect(screen.getByText("Showing 1 of 2")).toBeDefined();
    expect(screen.getByText("SQL Injection found in login endpoint")).toBeDefined();
    
    // Ensure the Low severity one is hidden
    const hiddenItem = screen.queryByText("Hardcoded AWS Key");
    expect(hiddenItem).toBeNull();
  });

  test("filters findings by text query", () => {
    render(<FindingsPanel findings={mockFindings} />);
    
    const searchInput = screen.getByPlaceholderText("Search findings…");
    fireEvent.change(searchInput, { target: { value: "aws" } });
    
    expect(screen.getByText("Showing 1 of 2")).toBeDefined();
    expect(screen.getByText("Hardcoded AWS Key")).toBeDefined();
    expect(screen.queryByText("SQL Injection found in login endpoint")).toBeNull();
  });
});
