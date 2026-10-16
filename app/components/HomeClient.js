'use client'
import { useState } from 'react'
import TopArtistsTab from './TopArtistsTab'
import ArtistListManager from './ArtistListManager'
import EventsTab from './EventsTab'
import SettingsTab from './SettingsTab'
import {
  CalendarIcon,
  CogIcon,
  BookmarkIcon,
  ChartBarIcon,
  IgnoreIcon
} from '../assets/SvgIcons'

const TABS = [
  { id: 'events', label: 'Events', icon: CalendarIcon },
  { id: 'top', label: 'Top Artists', icon: ChartBarIcon },
  { id: 'custom', label: 'Custom List', icon: BookmarkIcon },
  { id: 'ignored', label: 'Ignore List', icon: IgnoreIcon },
  { id: 'settings', label: 'Settings', icon: CogIcon }
]

export default function HomeClient({ defaultTab, isConfigured }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return defaultTab
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || defaultTab
  })

  return (
    // Below lg: logo/tabs stacked above content. At lg+, there's enough room
    // to move logo/tabs into a left sidebar instead and let content use the
    // full remaining width, so each tab's scrollbar hugs the browser edge.
    <main className='h-screen bg-neutral-800 overflow-hidden flex flex-col items-center lg:flex-row lg:items-stretch'>
      <div className='w-full max-w-5xl shrink-0 pt-6 lg:w-56 lg:max-w-none lg:shrink-0 lg:flex lg:flex-col lg:border-r lg:border-neutral-500 lg:pl-2'>
        <div className='gap-2 pb-3 mb-2 ml-2 mt-1 lg:pl-6 lg:mt-0 lg:ml-0'>
          <a
            href='https://github.com/cparsell/music-spider-service'
            target='_blank'
            className='flex flex-row gap-0.5'
          >
            <h1 className=' text-logo  font-bold text-neutral-200'>Music</h1>
            <span className='imglogo-slot '>
              <span className='imglogo '></span>
            </span>
            <h1 className=' text-logo sm:text-logo-small font-bold text-neutral-200 '>
              Spider
            </h1>
          </a>
        </div>
        <div className='flex gap-1 mb-0  border-neutral-200 border-b-2 bg-neutral-800 md:bg-neutral-800 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:mb-0'>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 -mb-0.5 border-b-2 lg:flex-none lg:justify-start lg:mb-0 lg:border-b-0 lg:pl-6 lg:text-left  ${
                  tab === t.id
                    ? 'border-neutral-900 bg-neutral-200 text-neutral-900'
                    : 'border-b-transparent border-r-neutral-800 border-r text-neutral-400 cursor-pointer '
                }`}
              >
                <Icon className='w-6 h-6 md:w-5 sm:h-5 shrink-0' />
                <span className='hidden md:inline'>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className='w-full flex-1 min-h-0 px-3 lg:max-w-none lg:px-6 bg-black'>
        <div className='h-full'>
          {tab === 'top' && (
            <TopArtistsTab
              description={
                isConfigured
                  ? 'Top artists based on your listening history. Select which term(s) are combined into the artist list used for event searches. Saved artists are added to the `Custom List`. Ignored artists are added to the `Ignore List`.'
                  : 'Top artists based on your listening history. Select which term(s) are combined into the artist list used for event searches. Configure sources in the settings.'
              }
            />
          )}
          {tab === 'custom' && (
            <ArtistListManager
              apiPath='/api/artists/manual'
              addLabel='Add'
              description='Manually add artists that should always be included in event search.'
            />
          )}
          {tab === 'ignored' && (
            <ArtistListManager
              apiPath='/api/artists/ignored'
              addLabel='Ignore'
              description="Artists in this list will be ignored when fetching events and top artist lists - i.e. artists who don't tour anymore, deceased artists, the phrase `Various Artists`, etc."
            />
          )}
          {tab === 'events' && <EventsTab />}
          {tab === 'settings' && <SettingsTab isConfigured={isConfigured} />}
        </div>
      </div>
    </main>
  )
}
