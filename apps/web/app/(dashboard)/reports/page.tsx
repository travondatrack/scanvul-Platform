import { prisma } from "@/lib/prisma";
import { scanScopeWhere } from "@/lib/access";
import { getOrgContextServer } from "@/lib/context";
import { requireActiveUser } from "@/lib/session";
import { ShieldCheck, AlertTriangle, RefreshCw, FileText, ChevronRight, Search, Filter, ShieldAlert, ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireActiveUser();
  const orgCtx = await getOrgContextServer();
  
  const resolvedParams = await searchParams;
  const page = parseInt((resolvedParams.page as string) || "1", 10);
  const limit = 15;
  const skip = (page - 1) * limit;

  const whereCondition = scanScopeWhere(user, "view", orgCtx);

  const [scans, totalCount] = await Promise.all([
    prisma.scan.findMany({
      where: whereCondition,
      include: {
        project: true,
        findings: {
          select: { severity: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.scan.count({ where: whereCondition })
  ]);
  
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scans & Reports"
        description="A consolidated view of all scan executions across your projects."
      />

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
            <FileText className="w-5 h-5 text-brand" />
            <span>All Scans</span>
          </h2>
        </div>

        {scans.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No scans found</h3>
            <p className="text-muted-foreground">Trigger a scan from your projects to see reports here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="p-4 border-b border-border">Scan ID</th>
                  <th className="p-4 border-b border-border">Project</th>
                  <th className="p-4 border-b border-border">Status</th>
                  <th className="p-4 border-b border-border">Risk Level</th>
                  <th className="p-4 border-b border-border">Findings</th>
                  <th className="p-4 border-b border-border">Date</th>
                  <th className="p-4 border-b border-border"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((scan) => {
                  const critical = scan.findings.filter(f => f.severity === "Critical").length;
                  const high = scan.findings.filter(f => f.severity === "High").length;
                  const total = scan.findings.length;

                  return (
                    <tr key={scan.id} className="hover:bg-muted/60 transition-colors group">
                      <td className="p-4 text-sm font-medium text-foreground truncate max-w-[120px]">
                        {scan.id.split("-")[0]}
                      </td>
                      <td className="p-4 text-sm text-foreground font-medium">
                        {scan.project?.name || "Unknown Project"}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={scan.status === "completed" ? "success" : scan.status === "failed" ? "destructive" : "default"}
                          className="gap-1.5 capitalize"
                        >
                          {scan.status === "completed" && <ShieldCheck className="w-3 h-3" />}
                          {scan.status === "failed" && <AlertTriangle className="w-3 h-3" />}
                          {(scan.status === "queued" || scan.status === "running") && <RefreshCw className="w-3 h-3 animate-spin" />}
                          <span>{scan.status}</span>
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-semibold ${
                          scan.riskLevel === "Critical" ? "text-destructive" :
                          scan.riskLevel === "High" ? "text-orange-500" :
                          scan.riskLevel === "Low" ? "text-success" : "text-muted-foreground"
                        }`}>
                          {scan.riskLevel || "-"}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center space-x-3">
                          <span className="text-foreground font-medium">{total}</span>
                          {(critical > 0 || high > 0) && (
                            <div className="flex space-x-2 text-xs">
                              {critical > 0 && <span className="text-destructive">{critical} C</span>}
                              {high > 0 && <span className="text-orange-500">{high} H</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(scan.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Link 
                          href={`/scan/${scan.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm", className: "opacity-0 group-hover:opacity-100" })}
                        >
                          <span>View</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Showing {skip + 1} to {Math.min(skip + limit, totalCount)} of {totalCount} scans
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={`?page=${page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Previous
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>Previous</Button>
              )}
              <div className="text-sm font-medium mx-2">
                Page {page} of {totalPages}
              </div>
              {page < totalPages ? (
                <Link href={`?page=${page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Next
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>Next</Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
