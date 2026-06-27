import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/access";
import { getOrgContextServer } from "@/lib/context";
import { requireActiveUser } from "@/lib/session";
import { Plus, FolderKanban, ShieldCheck, Clock, Github } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProjectsPage() {
  const user = await requireActiveUser();
  const orgCtx = await getOrgContextServer();

  const projects = await prisma.project.findMany({
    where: projectScopeWhere(user, "view", orgCtx),
    include: {
      organization: { select: { name: true } },
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage your secure code repositories and scan targets."
        actions={(
          <Link href="/projects/new" className={buttonVariants()}>
            <Plus className="w-5 h-5" />
            <span>New Project</span>
          </Link>
        )}
      />

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-brand/10">
            <FolderKanban className="h-8 w-8 text-brand" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">No projects yet</h3>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Get started by creating a new project to run SAST, Secret, and Dependency scans on your code.
          </p>
          <Link href="/projects/new" className={buttonVariants()}>
            <Plus className="w-5 h-5" />
            <span>Create your first project</span>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="group flex h-full cursor-pointer flex-col p-6 transition-all duration-200 hover:border-brand/30 hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted transition-colors group-hover:border-brand/20 group-hover:bg-brand/10">
                      {project.sourceType === "github" ? (
                        <Github className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-brand" />
                      ) : (
                        <FolderKanban className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-brand" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-brand">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {project.organization?.name ?? "Personal"} - {project.visibility}
                      </p>
                    </div>
                  </div>
                  <Badge variant={project.status === "active" ? "success" : "muted"}>
                    {project.status}
                  </Badge>
                </div>

                {project.description ? (
                  <p className="mb-6 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {project.scans.length > 0
                        ? new Date(project.scans[0].createdAt).toLocaleDateString()
                        : "No scans yet"}
                    </span>
                  </div>
                  {project.scans.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-success">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-medium">Scanned</span>
                    </div>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
