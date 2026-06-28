/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import DashboardOverviewPage from "@/app/(dashboard)/dashboard/page";
import { jest } from "@jest/globals";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { count: jest.fn() },
    scan: { count: jest.fn() },
    finding: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/session", () => ({
  requireActiveUser: jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" }),
}));

jest.mock("@/lib/access", () => ({
  accessibleProjectWhere: jest.fn().mockReturnValue({}),
  accessibleScanWhere: jest.fn().mockReturnValue({}),
  projectScopeWhere: jest.fn().mockReturnValue({}),
  scanScopeWhere: jest.fn().mockReturnValue({}),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn().mockReturnValue({ value: JSON.stringify({ type: "personal" }) }),
  })),
}));

describe("DashboardOverviewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders aggregate metrics correctly", async () => {
    (prisma.project.count as jest.Mock).mockResolvedValue(5);
    (prisma.scan.count as jest.Mock).mockResolvedValue(12);
    (prisma.finding.findMany as jest.Mock).mockResolvedValue([
      { severity: "Critical", status: "open" },
      { severity: "High", status: "open" },
      { severity: "High", status: "open" },
      { severity: "Medium", status: "confirmed" },
      { severity: "Low", status: "open" },
      { severity: "Critical", status: "fixed" }, // Should be excluded
    ]);

    // Await the async server component
    const page = await DashboardOverviewPage();
    render(page);

    // Verify metrics are rendered
    expect(screen.getByText("Total Projects")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined(); // 5 projects

    expect(screen.getByText("Total Scans")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined(); // 12 scans

    // Check critical findings
    expect(screen.getByText("Critical Risks")).toBeDefined();
    // There is 1 active critical finding
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);

    // Check high findings
    expect(screen.getByText("High Risks")).toBeDefined();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Platform Health")).toBeDefined();
    expect(screen.getByText(/You have 5 open findings/)).toBeDefined();
  });
});
