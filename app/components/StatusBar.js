export default function StatusBar({ message, error }) {
  return (
    <div
      className={`min-h-2 flex items-center px-3 py-1 mb-3 text-sm rounded bg-neutral-700 ${
        error ? "text-red-300" : "text-neutral-200"
      }`}
    >
      {message}
    </div>
  );
}
