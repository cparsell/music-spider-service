// Per-source status chip for a running search.
function SourceIcon({ state }) {
  if (state === 'done') {
    return (
      <svg
        viewBox='0 0 16 16'
        className='size-3.5 shrink-0'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        <path d='M3 8.5l3.2 3.2L13 4.5' />
      </svg>
    )
  }
  if (state === 'failed') {
    return (
      <svg
        viewBox='0 0 16 16'
        className='size-3.5 shrink-0'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        aria-hidden='true'
      >
        <path d='M4 4l8 8M12 4l-8 8' />
      </svg>
    )
  }
  // running: a spinning ring
  return (
    <span
      className='size-3 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin'
      aria-hidden='true'
    />
  )
}

const SOURCE_STYLES = {
  done: 'text-green-500',
  failed: 'text-red-300',
  running: 'text-neutral-300'
}
const SOURCE_STATE_LABELS = {
  done: 'done',
  failed: 'failed',
  running: 'searching'
}

function SourceChip({ source }) {
  const { label, state, fraction, count, error } = source
  const showPercent = state === 'running' && typeof fraction === 'number'
  return (
    <span
      title={state === 'failed' && error ? error : undefined}
      className={`inline-flex items-center gap-1 rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-xs ${SOURCE_STYLES[state]}`}
    >
      <SourceIcon state={state} />
      <span className='text-neutral-200'>{label}</span>
      {showPercent && <span>{Math.round(fraction * 100)}%</span>}
      {state === 'done' && typeof count === 'number' && <span>{count}</span>}
      <span className='sr-only'>{SOURCE_STATE_LABELS[state]}</span>
    </span>
  )
}

export default function StatusBar({ message, error, progress }) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null
  const sources = progress?.sources || []

  return (
    <div className='relative min-h-2 border-t border-neutral-700 bg-neutral-900 overflow-hidden -mx-6 mb-0 px-6 py-0.5'>
      {pct !== null && (
        <div
          className='absolute inset-y-0 left-0 bg-neutral-500 transition-[width] duration-300'
          style={{ width: `${pct}%` }}
        />
      )}
      <div
        className={`relative flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 min-h-5 text-sm ${
          error ? 'text-red-300' : 'text-neutral-200'
        }`}
      >
        <span>{message}</span>
        {sources.length > 0 && (
          <span className='flex flex-wrap items-center gap-1.5'>
            {sources.map(s => (
              <SourceChip key={s.label} source={s} />
            ))}
          </span>
        )}
        {pct !== null && (
          <span className='ml-auto text-neutral-300'>{pct}%</span>
        )}
      </div>
    </div>
  )
}
