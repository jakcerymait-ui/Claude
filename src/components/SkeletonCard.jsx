export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-4 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <SkeletonLine className="w-1/3 h-6" />
      <SkeletonLine className="w-full" />
      <SkeletonLine className="w-3/4" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}

export function SkeletonPlayerCard() {
  return (
    <div className="card">
      <div className="flex gap-4 mb-5">
        <div className="skeleton w-20 h-20 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-2">
          <SkeletonLine className="w-1/2 h-6" />
          <SkeletonLine className="w-1/3 h-4" />
          <SkeletonLine className="w-1/4 h-4" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="card space-y-3">
      <SkeletonLine className="w-1/4 h-6 mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonLine className="w-1/4 h-4" />
          <SkeletonLine className="w-1/4 h-4" />
          <SkeletonLine className="w-1/4 h-4" />
          <SkeletonLine className="w-1/4 h-4" />
        </div>
      ))}
    </div>
  );
}
