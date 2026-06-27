import { prisma } from "@/lib/prisma";
import { accessibleProjectWhere, accessibleScanWhere } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { FolderKanban, ShieldAlert, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardOverviewPage() {
  const user = await requireActiveUser();

  // Fetch aggregate stats
  const totalProjects = await prisma.project.count({
    where: user.roleGlobal === "admin" ? undefined : accessibleProjectWhere(user.id, "view"),
  });
  
  const totalScans = await prisma.scan.count({
    where: user.roleGlobal === "admin" ? undefined : accessibleScanWhere(user.id, "view"),
  });

  const findings = await prisma.finding.findMany({
    where: {
      scan: user.roleGlobal === "admin" ? undefined : accessibleScanWhere(user.id, "view"),
    },
    select: { severity: true, status: true }
  });

  const activeFindings = findings.filter(f => f.status !== "false_positive" && f.status !== "fixed");
  
  const criticalCount = activeFindings.filter(f => f.severity === "Critical").length;
  const highCount = activeFindings.filter(f => f.severity === "High").length;
  const mediumCount = activeFindings.filter(f => f.severity === "Medium").length;
  const lowCount = activeFindings.filter(f => f.severity === "Low").length;

  const totalActive = activeFindings.length;
  
  // Calculate percentages for the progress bars
  const criticalPct = totalActive > 0 ? (criticalCount / totalActive) * 100 : 0;
  const highPct = totalActive > 0 ? (highCount / totalActive) * 100 : 0;
  const mediumPct = totalActive > 0 ? (mediumCount / totalActive) * 100 : 0;
  const lowPct = totalActive > 0 ? (lowCount / totalActive) * 100 : 0;

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
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Active Vulnerabilities Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-400 font-medium">Critical</span>
                <span className="text-slate-400">{criticalCount}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full" style={{ width: `${criticalPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-orange-400 font-medium">High</span>
                <span className="text-slate-400">{highCount}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${highPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-amber-400 font-medium">Medium</span>
                <span className="text-slate-400">{mediumCount}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: `${mediumPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-emerald-400 font-medium">Low</span>
                <span className="text-slate-400">{lowCount}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: `${lowPct}%` }}></div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

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
