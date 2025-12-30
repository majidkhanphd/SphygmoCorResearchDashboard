import { Skeleton } from "@/components/ui/skeleton";

export function FeaturedCarouselSkeleton() {
  return (
    <div className="w-full py-8 sm:py-12 md:py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <Skeleton className="h-6 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <div className="relative">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[320px] sm:w-[400px]">
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-20 w-full mb-3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicationsBannerSkeleton() {
  return (
    <div className="w-full py-1 sm:py-2 md:py-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4 sm:mb-6 md:mb-8 px-2 sm:px-4">
          <div className="inline-block px-6 sm:px-10 md:px-16 py-6 sm:py-8 md:py-10 rounded-lg bg-muted/30">
            <Skeleton className="h-10 sm:h-12 md:h-14 w-48 sm:w-64 mx-auto mb-3 sm:mb-4" />
            <Skeleton className="h-4 sm:h-5 w-full max-w-lg mx-auto" />
            <Skeleton className="h-4 sm:h-5 w-3/4 max-w-md mx-auto mt-2" />
          </div>
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function SearchBarSkeleton() {
  return (
    <div className="mb-6 sm:mb-10 md:mb-12">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row items-stretch sm:items-center mb-6">
        <Skeleton className="flex-1 h-10 sm:h-12 rounded-[5px]" />
        <Skeleton className="w-full sm:w-48 h-10 sm:h-12 rounded-[5px]" />
      </div>
    </div>
  );
}

export function SidebarFiltersSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-20 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-16 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicationsListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg bg-card">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-2/3 mb-2" />
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-4 w-8" />
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-9 w-9 rounded" />
      <Skeleton className="h-9 w-9 rounded" />
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="bg-background research-page animate-pulse">
      <FeaturedCarouselSkeleton />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PublicationsBannerSkeleton />
        <SearchBarSkeleton />
        <div className="flex gap-6">
          <div className="w-64 hidden md:block">
            <SidebarFiltersSkeleton />
          </div>
          <div className="flex-1">
            <PublicationsListSkeleton count={8} />
            <PaginationSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
