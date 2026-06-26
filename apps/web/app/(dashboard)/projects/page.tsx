import { prisma } from "@/lib/prisma";
import { accessibleProjectWhere } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { Plus, FolderKanban, ShieldCheck, Clock, Github } from "lucide-react";
import Link from "next/link";

export default async function ProjectsPage() {
  const user = await requireActiveUser();

  const projects = await prisma.project.findMany({
    where: user.roleGlobal === "admin" ? undefined : accessibleProjectWhere(user.id, "view"),
    include: {
      organization: { select: { name: true } },
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Projects</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage your secure code repositories and scan targets.</p>
        </div>
        <Link href="/projects/new" className="flex items-center space-x-2 bg-brand hover:opacity-90 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm active:scale-[0.98]">
          <Plus className="w-5 h-5" />
          <span>New Project</span>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/30 dark:backdrop-blur-md shadow-sm rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-brand/10 dark:bg-brand/20 rounded-2xl flex items-center justify-center mb-4">
            <FolderKanban className="w-8 h-8 text-brand" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No projects yet</h3>
          <p className="text-slate-500 dark:text-zinc-400 max-w-sm mb-6">
            Get started by creating a new project to run SAST, Secret, and Dependency scans on your code.
          </p>
          <Link href="/projects/new" className="flex items-center space-x-2 bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:opacity-90 transition-colors">
            <Plus className="w-5 h-5" />
            <span>Create your first project</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="group border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/40 dark:backdrop-blur-md shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-xl dark:hover:shadow-brand/10 rounded-2xl p-6 transition-all duration-300 hover:border-brand/30 dark:hover:border-brand/30 cursor-pointer flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-transparent flex items-center justify-center group-hover:bg-brand/10 group-hover:border-transparent transition-colors">
                      {project.sourceType === "github" ? (
                        <Github className="w-5 h-5 text-slate-400 dark:text-zinc-400 group-hover:text-brand transition-colors" />
                      ) : (
                        <FolderKanban className="w-5 h-5 text-slate-400 dark:text-zinc-400 group-hover:text-brand transition-colors" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-brand transition-colors">{project.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">
                        {project.organization?.name ?? "Personal"} · {project.visibility}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${project.status === "active" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"}`}>
                    {project.status}
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 line-clamp-2">{project.description}</p>
                )}

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800/50 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-slate-400 dark:text-zinc-500">
                    <Clock className="w-4 h-4" />
                    <span>{project.scans.length > 0 ? new Date(project.scans[0].createdAt).toLocaleDateString() : "No scans yet"}</span>
                  </div>
                  {project.scans.length > 0 && (
                    <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-medium">Scanned</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
