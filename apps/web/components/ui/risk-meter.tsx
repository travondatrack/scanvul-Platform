import { cn } from "@/lib/utils";

interface RiskMeterProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

export function RiskMeter({ score, size = "md", className, showLabel = true }: RiskMeterProps) {
  const safeScore = Math.max(0, Math.min(100, score));
  
  let colorClass = "bg-emerald-500";
  let labelClass = "text-emerald-600 dark:text-emerald-400";
  let label = "Low Risk";

  if (safeScore >= 80) {
    colorClass = "bg-red-500";
    labelClass = "text-red-600 dark:text-red-400";
    label = "Critical Risk";
  } else if (safeScore >= 60) {
    colorClass = "bg-orange-500";
    labelClass = "text-orange-600 dark:text-orange-400";
    label = "High Risk";
  } else if (safeScore >= 30) {
    colorClass = "bg-amber-500";
    labelClass = "text-amber-600 dark:text-amber-400";
    label = "Medium Risk";
  }

  const heightClass = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between items-end">
          <span className={cn("text-sm font-bold", labelClass)}>{label}</span>
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{safeScore.toFixed(1)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden", heightClass)}>
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", colorClass)}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}
