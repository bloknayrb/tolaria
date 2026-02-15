import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NoteList } from './NoteList'
import type { VaultEntry, SidebarSelection } from '../types'

const allSelection: SidebarSelection = { kind: 'filter', filter: 'all' }
const noopSelect = vi.fn()

const mockEntries: VaultEntry[] = [
  {
    path: '/Users/luca/Laputa/project/26q1-laputa-app.md',
    filename: '26q1-laputa-app.md',
    title: 'Build Laputa App',
    isA: 'Project',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[topic/software-development]]'],
    status: 'Active',
    owner: 'Luca',
    cadence: null,
    modifiedAt: 1700000000,
    fileSize: 1024,
  },
  {
    path: '/Users/luca/Laputa/note/facebook-ads-strategy.md',
    filename: 'facebook-ads-strategy.md',
    title: 'Facebook Ads Strategy',
    isA: 'Note',
    aliases: [],
    belongsTo: ['[[project/26q1-laputa-app]]'],
    relatedTo: ['[[topic/growth]]'],
    status: null,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    fileSize: 847,
  },
  {
    path: '/Users/luca/Laputa/person/matteo-cellini.md',
    filename: 'matteo-cellini.md',
    title: 'Matteo Cellini',
    isA: 'Person',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    fileSize: 320,
  },
  {
    path: '/Users/luca/Laputa/event/2026-02-14-kickoff.md',
    filename: '2026-02-14-kickoff.md',
    title: 'Kickoff Meeting',
    isA: 'Event',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    fileSize: 512,
  },
  {
    path: '/Users/luca/Laputa/topic/software-development.md',
    filename: 'software-development.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    fileSize: 256,
  },
]

describe('NoteList', () => {
  it('shows empty state when no entries', () => {
    const { container } = render(<NoteList entries={[]} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('No notes found')).toBeInTheDocument()
    expect(container.querySelector('.note-list__count')!.textContent).toBe('0')
  })

  it('renders all entries with All Notes filter', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
    expect(container.querySelector('.note-list__count')!.textContent).toBe('5')
  })

  it('filters by People', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={{ kind: 'filter', filter: 'people' }} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Matteo Cellini')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
    expect(container.querySelector('.note-list__count')!.textContent).toBe('1')
  })

  it('filters by Events', () => {
    render(<NoteList entries={mockEntries} selection={{ kind: 'filter', filter: 'events' }} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
  })

  it('filters by section group type', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={{ kind: 'sectionGroup', type: 'Project' }} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    expect(container.querySelector('.note-list__count')!.textContent).toBe('1')
  })

  it('shows entity pinned at top with grouped children', () => {
    const { container } = render(
      <NoteList entries={mockEntries} selection={{ kind: 'entity', entry: mockEntries[0] }} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Entity title appears in header and pinned card
    expect(screen.getAllByText('Build Laputa App').length).toBeGreaterThanOrEqual(1)
    // Child entry in "Children" group
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    // Unrelated entries not shown
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    // Group headers shown
    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText('Related To')).toBeInTheDocument()
    // Count shows grouped items (1 child + 1 related)
    expect(container.querySelector('.note-list__count')!.textContent).toBe('2')
    // Type pills hidden in entity view
    expect(container.querySelector('.note-list__pills')).toBeNull()
  })

  it('filters by topic (relatedTo references)', () => {
    render(
      <NoteList entries={mockEntries} selection={{ kind: 'topic', entry: mockEntries[4] }} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />
    )
    // Build Laputa App has relatedTo: [[topic/software-development]]
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
  })

  it('renders a search bar', () => {
    render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('filters by search query (case-insensitive substring)', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search notes...')
    fireEvent.change(input, { target: { value: 'facebook' } })
    expect(screen.getByText('Facebook Ads Strategy')).toBeInTheDocument()
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
    expect(container.querySelector('.note-list__count')!.textContent).toBe('1')
  })

  it('sorts entries by last modified descending', () => {
    const entriesWithDifferentDates: VaultEntry[] = [
      { ...mockEntries[0], modifiedAt: 1000, title: 'Oldest' },
      { ...mockEntries[1], modifiedAt: 3000, title: 'Newest', path: '/p2' },
      { ...mockEntries[2], modifiedAt: 2000, title: 'Middle', path: '/p3' },
    ]
    render(<NoteList entries={entriesWithDifferentDates} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    const titles = screen.getAllByText(/Oldest|Newest|Middle/)
    const titleTexts = titles.map((el) => el.textContent)
    expect(titleTexts).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('renders type filter pills with counts and hides empty types', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    const pills = container.querySelectorAll('.note-list__pill')
    const labels = Array.from(pills).map((p) => p.textContent)
    expect(labels).toContain('All 5')
    expect(labels).toContain('Projects 1')
    expect(labels).toContain('Notes 1')
    expect(labels).toContain('Events 1')
    expect(labels).toContain('People 1')
    // Empty types should be hidden
    expect(labels.some((l) => l?.startsWith('Experiments'))).toBe(false)
    expect(labels.some((l) => l?.startsWith('Procedures'))).toBe(false)
    expect(labels.some((l) => l?.startsWith('Responsibilities'))).toBe(false)
  })

  it('filters by type pill', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    const projectsPill = Array.from(container.querySelectorAll('.note-list__pill')).find((p) => p.textContent?.startsWith('Projects'))!
    fireEvent.click(projectsPill)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
    expect(screen.queryByText('Matteo Cellini')).not.toBeInTheDocument()
    expect(screen.queryByText('Facebook Ads Strategy')).not.toBeInTheDocument()
  })

  it('clicking All pill resets type filter', () => {
    const { container } = render(<NoteList entries={mockEntries} selection={allSelection} selectedNote={null} onSelectNote={noopSelect} allContent={{}} onCreateNote={vi.fn()} />)
    const peoplePill = Array.from(container.querySelectorAll('.note-list__pill')).find((p) => p.textContent?.startsWith('People'))!
    fireEvent.click(peoplePill)
    expect(screen.queryByText('Build Laputa App')).not.toBeInTheDocument()
    const allPill = Array.from(container.querySelectorAll('.note-list__pill')).find((p) => p.textContent?.startsWith('All'))!
    fireEvent.click(allPill)
    expect(screen.getByText('Build Laputa App')).toBeInTheDocument()
  })
})
