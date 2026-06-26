import { render, screen } from "@testing-library/react";
import DashboardOverviewPage from "@/app/(dashboard)/dashboard/page";
import { jest } from "@jest/globals";

// Mock dependencies
const prismaMock = {
  project: { count: jest.fn() },
  scan: { count: jest.fn() },
  finding: { findMany: jest.fn() },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/session", () => ({
  requireActiveUser: jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" }),
}));

jest.mock("@/lib/access", () => ({
  accessibleProjectWhere: jest.fn().mockReturnValue({}),
  accessibleScanWhere: jest.fn().mockReturnValue({}),
}));

describe("DashboardOverviewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders aggregate metrics correctly", async () => {
    (prismaMock.project.count as jest.Mock).mockResolvedValue(5);
    (prismaMock.scan.count as jest.Mock).mockResolvedValue(12);
    (prismaMock.finding.findMany as jest.Mock).mockResolvedValue([
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
    expect(screen.getByText("1")).toBeDefined();

    // Check high findings
    expect(screen.getByText("High Risks")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();

    expect(screen.getByText("Platform Health")).toBeDefined();
    expect(screen.getByText(/You have 5 open findings/)).toBeDefined();
  });
});
