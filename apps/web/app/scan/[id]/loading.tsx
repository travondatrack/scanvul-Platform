import { FindingListSkeleton, PageHeaderSkeleton, StatCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ScanReportLoading() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-10 w-full" />
        </div>
        <FindingListSkeleton />
      </div>
    </div>
  );
}
