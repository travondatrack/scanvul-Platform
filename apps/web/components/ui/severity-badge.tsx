import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Shield, Info } from "lucide-react";

export type SeverityLevel = "Critical" | "High" | "Medium" | "Low" | "Unknown" | string;

interface SeverityBadgeProps {
  level: SeverityLevel;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({ level, className, showIcon = true }: SeverityBadgeProps) {
  const normalizedLevel = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();

  const config: Record<string, { color: string; icon: any }> = {
    Critical: {
      color: "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]",
      icon: AlertCircle,
    },
    High: {
      color: "border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
      icon: AlertTriangle,
    },
    Medium: {
      color: "border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
      icon: Shield,
    },
    Low: {
      color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
      icon: Info,
    },
  };

  const { color, icon: Icon } = config[normalizedLevel] || {
    color: "border-white/10 bg-white/5 text-slate-300",
    icon: Info,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        color,
        className
      )}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {normalizedLevel}
    </span>
  );
}
