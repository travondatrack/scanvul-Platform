import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton cards={3} />
    </div>
  );
}
