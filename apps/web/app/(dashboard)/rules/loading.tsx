import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function RulesLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton cards={2} />
    </div>
  );
}
