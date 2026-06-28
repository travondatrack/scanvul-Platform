import { prisma } from "@/lib/prisma";
import { projectScopeWhere, scanScopeWhere } from "@/lib/access";
import { getOrgContextServer } from "@/lib/context";
import { requireActiveUser } from "@/lib/session";
import { FolderKanban, ShieldAlert, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RiskRadarChart } from "@/components/charts/risk-radar-chart";

export default async function DashboardOverviewPage() {
  const user = await requireActiveUser();
  const orgCtx = await getOrgContextServer();

  // Fetch aggregate stats
  const totalProjects = await prisma.project.count({
    where: projectScopeWhere(user, "view", orgCtx),
  });
  
  const totalScans = await prisma.scan.count({
    where: scanScopeWhere(user, "view", orgCtx),
  });

  const findings = await prisma.finding.findMany({
    where: {
      scan: scanScopeWhere(user, "view", orgCtx),
    },
    select: { severity: true, status: true }
  });

  const activeFindings = findings.filter(f => f.status !== "false_positive" && f.status !== "fixed");
  
  const criticalCount = activeFindings.filter(f => f.severity === "Critical").length;
  const highCount = activeFindings.filter(f => f.severity === "High").length;
  const mediumCount = activeFindings.filter(f => f.severity === "Medium").length;
  const lowCount = activeFindings.filter(f => f.severity === "Low").length;

  const totalActive = activeFindings.length;
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="High-level metrics across all your secure code repositories."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="group transition-colors hover:border-brand/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-muted-foreground font-medium">Total Projects</h3>
            <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-foreground">{totalProjects}</p>
        </Card>

        <Card className="group transition-colors hover:border-brand/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-muted-foreground font-medium">Total Scans</h3>
            <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-foreground">{totalScans}</p>
        </Card>

        <Card className="group transition-colors hover:border-destructive/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-muted-foreground font-medium">Critical Risks</h3>
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-destructive">{criticalCount}</p>
        </Card>

        <Card className="group transition-colors hover:border-warning/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-muted-foreground font-medium">High Risks</h3>
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center border border-warning/20 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-warning">{highCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RiskRadarChart
          critical={criticalCount}
          high={highCount}
          medium={mediumCount}
          low={lowCount}
        />

        <Card className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Platform Health</h2>
          <p className="text-muted-foreground max-w-md">
            All SAST and Secret Scanning engines are online and protecting your codebases. 
            You have {totalActive} open findings across your repositories.
          </p>
          <Link href="/projects" className={buttonVariants({ className: "mt-6" })}>
            Manage Projects
          </Link>
        </Card>
      </div>
    </div>
  );
}
