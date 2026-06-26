import { FormSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="md:col-span-2">
          <FormSkeleton />
        </div>
      </div>
    </div>
  );
}
