export default function StatusBar({ message, error, progress }) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null;

  return (
    <div className="relative min-h-2 border-t border-neutral-700 bg-neutral-900 overflow-hidden -mx-6 mb-0 px-6 py-0.5">
      {pct !== null && (
        <div
          className="absolute inset-y-0 left-0 bg-neutral-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      )}
      <div
        className={`relative flex items-center gap-2 px-3 py-1 min-h-5 text-sm ${
          error ? "text-red-300" : "text-neutral-200"
        }`}
      >
        <span>{message}</span>
        {pct !== null && (
          <span className="ml-auto text-neutral-300">{pct}%</span>
        )}
      </div>
    </div>
  );
}
