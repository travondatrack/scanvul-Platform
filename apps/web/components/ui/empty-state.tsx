import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30", className)}>
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-6 shadow-sm">
        <Icon className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
