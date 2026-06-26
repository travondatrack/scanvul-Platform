import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </div>
  );
}
