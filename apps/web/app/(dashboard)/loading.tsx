import { PageHeaderSkeleton, StatCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-6 w-56" />
          <div className="mt-6 space-y-5">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-5/6 rounded-full" />
            <Skeleton className="h-3 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Skeleton className="mx-auto h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto mt-6 h-6 w-48" />
          <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
          <Skeleton className="mx-auto mt-2 h-4 w-56 max-w-full" />
        </div>
      </div>
    </div>
  );
}
