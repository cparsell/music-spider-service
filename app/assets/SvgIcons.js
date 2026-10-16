function Icon({ size = 20, className, children }) {
  return (
    <svg
      viewBox='0 0 20 20'
      width={size}
      height={size}
      fill='none'
      aria-hidden='true'
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

export function CalendarIcon({ className, size = 20 }) {
  return (
    <Icon size={size} className={className}>
      <rect
        x='3'
        y='4'
        width='14'
        height='13'
        rx='1.5'
        stroke='currentColor'
        strokeWidth='2'
      />
      <path d='M3 8h14' stroke='currentColor' strokeWidth='2' />
      <path
        d='M6.5 2.5v3M13.5 2.5v3'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </Icon>
  )
}

export function ChartBarIcon({ className, size = 20 }) {
  return (
    <Icon size={size} className={className}>
      <path
        d='M4 16V11M10 16V7M16 16V4'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </Icon>
  )
}

export function BookmarkIcon({ saved = false, size = 20, className }) {
  return (
    <Icon size={size} className={className}>
      <path
        d='M5 3h10a1 1 0 0 1 1 1v13l-6-3.5L4 17V4a1 1 0 0 1 1-1Z'
        fill={saved ? 'currentColor' : 'none'}
        stroke='currentColor'
        strokeWidth='2'
        strokeLinejoin='round'
      />
    </Icon>
  )
}

export function IgnoreIcon({ ignored = false, size = 20, className }) {
  return (
    <Icon size={size} className={className}>
      <circle cx='10' cy='10' r='7' stroke='currentColor' strokeWidth='2' />
      {ignored ? (
        <path
          d='M6.5 10.5l2.5 2.5 4.5-5'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      ) : (
        <path
          d='M5.5 5.5l9 9'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
        />
      )}
    </Icon>
  )
}

export function CogIcon({ className }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.992l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.688 7.688 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' />
      <path d='M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' />
    </svg>
  )
}

export function RemoveIcon({ className }) {
  return (
    <svg
      viewBox='0 0 18 18'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path
        d='M4 6h12M8 6V4h4v2M5.5 6l.75 10a1 1 0 0 0 1 .9h5.5a1 1 0 0 0 1-.9L14.5 6M8.5 9v5M11.5 9v5'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
