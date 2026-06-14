export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mx-auto h-14 max-w-2xl rounded-full bg-gray-200" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex gap-4">
              <div className="h-24 w-24 rounded-xl bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-gray-200" />
                <div className="h-4 w-3/4 rounded bg-gray-200" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-6 rounded bg-gray-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
