import { useState } from 'react'
import type { VaultEntry, SidebarSelection } from '../types'
import './NoteList.css'

interface NoteListProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  selectedNote: VaultEntry | null
  allContent: Record<string, string>
  onSelectNote: (entry: VaultEntry) => void
  onCreateNote: () => void
}

interface RelationshipGroup {
  label: string
  entries: VaultEntry[]
}

/** Extract first ~80 chars of content after the title heading */
function getSnippet(content: string | undefined): string {
  if (!content) return ''
  // Remove frontmatter
  const withoutFm = content.replace(/^---[\s\S]*?---\s*/, '')
  // Remove the first heading
  const withoutH1 = withoutFm.replace(/^#\s+.*\n+/, '')
  // Clean markdown syntax and collapse whitespace
  const clean = withoutH1
    .replace(/[#*_`\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  return clean.slice(0, 80) + (clean.length > 80 ? '...' : '')
}

/** Format a relative date string */
function relativeDate(ts: number | null): string {
  if (!ts) return ''
  const now = Math.floor(Date.now() / 1000)
  const diff = now - ts
  if (diff < 0) {
    // Future date - just show the date
    const date = new Date(ts * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  const date = new Date(ts * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Get the best date to display for an entry (prefer modifiedAt, fallback to createdAt) */
function getDisplayDate(entry: VaultEntry): number | null {
  // Prefer modifiedAt (most recent activity), but fall back to createdAt
  return entry.modifiedAt ?? entry.createdAt
}

/** Check if a wikilink array (e.g. belongsTo) references a given entry by path stem */
function refsMatch(refs: string[], entry: VaultEntry): boolean {
  // Extract the path stem: /Users/luca/Laputa/project/26q1-laputa-app.md → project/26q1-laputa-app
  const stem = entry.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
  return refs.some((ref) => {
    const inner = ref.replace(/^\[\[/, '').replace(/\]\]$/, '')
    return inner === stem
  })
}

/** Resolve wikilink references to actual VaultEntry objects */
function resolveRefs(refs: string[], entries: VaultEntry[]): VaultEntry[] {
  return refs
    .map((ref) => {
      const inner = ref.replace(/^\[\[/, '').replace(/\]\]$/, '')
      return entries.find((e) => {
        const stem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
        if (stem === inner) return true
        const fileStem = e.filename.replace(/\.md$/, '')
        if (fileStem === inner.split('/').pop()) return true
        return false
      })
    })
    .filter((e): e is VaultEntry => e !== undefined)
}

function sortByModified(a: VaultEntry, b: VaultEntry): number {
  return (getDisplayDate(b) ?? 0) - (getDisplayDate(a) ?? 0)
}

/** Build relationship groups for an entity view */
function buildRelationshipGroups(entity: VaultEntry, allEntries: VaultEntry[]): RelationshipGroup[] {
  const groups: RelationshipGroup[] = []
  const seen = new Set<string>([entity.path])

  // 1. Children: items whose belongsTo references this entity (non-events)
  const children = allEntries
    .filter((e) => !seen.has(e.path) && e.isA !== 'Event' && refsMatch(e.belongsTo, entity))
    .sort(sortByModified)
  if (children.length > 0) {
    groups.push({ label: 'Children', entries: children })
    children.forEach((e) => seen.add(e.path))
  }

  // 2. Events that reference this entity (via belongsTo or relatedTo)
  const events = allEntries
    .filter(
      (e) =>
        !seen.has(e.path) &&
        e.isA === 'Event' &&
        (refsMatch(e.belongsTo, entity) || refsMatch(e.relatedTo, entity))
    )
    .sort(sortByModified)
  if (events.length > 0) {
    groups.push({ label: 'Events', entries: events })
    events.forEach((e) => seen.add(e.path))
  }

  // 3. Referenced By: non-event items whose relatedTo references this entity
  const referencedBy = allEntries
    .filter((e) => !seen.has(e.path) && e.isA !== 'Event' && refsMatch(e.relatedTo, entity))
    .sort(sortByModified)
  if (referencedBy.length > 0) {
    groups.push({ label: 'Referenced By', entries: referencedBy })
    referencedBy.forEach((e) => seen.add(e.path))
  }

  // 4. Belongs To: resolve this entity's own belongsTo references
  const belongsTo = resolveRefs(entity.belongsTo, allEntries).filter((e) => !seen.has(e.path))
  if (belongsTo.length > 0) {
    groups.push({ label: 'Belongs To', entries: belongsTo })
    belongsTo.forEach((e) => seen.add(e.path))
  }

  // 5. Related To: resolve this entity's own relatedTo references
  const relatedTo = resolveRefs(entity.relatedTo, allEntries).filter((e) => !seen.has(e.path))
  if (relatedTo.length > 0) {
    groups.push({ label: 'Related To', entries: relatedTo })
    relatedTo.forEach((e) => seen.add(e.path))
  }

  return groups
}

function filterEntries(entries: VaultEntry[], selection: SidebarSelection): VaultEntry[] {
  switch (selection.kind) {
    case 'filter':
      switch (selection.filter) {
        case 'all':
          return entries
        case 'people':
          return entries.filter((e) => e.isA === 'Person')
        case 'events':
          return entries.filter((e) => e.isA === 'Event')
        case 'favorites':
          // TODO: Implement favorites (needs a "favorite" field in frontmatter)
          return []
        case 'trash':
          // TODO: Implement trash (needs deleted/archived status)
          return []
      }
      break
    case 'sectionGroup':
      return entries.filter((e) => e.isA === selection.type)
    case 'entity':
      // Handled separately via buildRelationshipGroups
      return []
    case 'topic': {
      const topic = selection.entry
      return entries.filter((e) => refsMatch(e.relatedTo, topic))
    }
  }
}

const TYPE_PILLS = [
  { label: 'All', type: null },
  { label: 'Projects', type: 'Project' },
  { label: 'Notes', type: 'Note' },
  { label: 'Events', type: 'Event' },
  { label: 'People', type: 'Person' },
  { label: 'Experiments', type: 'Experiment' },
  { label: 'Procedures', type: 'Procedure' },
  { label: 'Responsibilities', type: 'Responsibility' },
] as const

export function NoteList({ entries, selection, selectedNote, allContent, onSelectNote, onCreateNote }: NoteListProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const isEntityView = selection.kind === 'entity'

  // Entity view: build relationship groups
  const entityGroups = isEntityView
    ? buildRelationshipGroups(selection.entry, entries)
    : []

  // Non-entity view: flat filtered list
  const filtered = isEntityView ? [] : filterEntries(entries, selection)
  const sorted = isEntityView ? [] : [...filtered].sort(sortByModified)

  // Search filter
  const query = search.trim().toLowerCase()

  // For entity view: filter within groups
  const searchedGroups = query
    ? entityGroups
        .map((g) => ({
          ...g,
          entries: g.entries.filter((e) => e.title.toLowerCase().includes(query)),
        }))
        .filter((g) => g.entries.length > 0)
    : entityGroups

  // For flat view
  const searched = query
    ? sorted.filter((e) => e.title.toLowerCase().includes(query))
    : sorted

  // Compute per-type counts from the searched results (before type filter)
  const typeCounts = new Map<string | null, number>()
  typeCounts.set(null, searched.length) // "All" count
  for (const entry of searched) {
    if (entry.isA) {
      typeCounts.set(entry.isA, (typeCounts.get(entry.isA) ?? 0) + 1)
    }
  }

  // Type filter pills (flat view only)
  const displayed = typeFilter
    ? searched.filter((e) => e.isA === typeFilter)
    : searched

  // Total count for header
  const totalCount = isEntityView
    ? searchedGroups.reduce((sum, g) => sum + g.entries.length, 0)
    : displayed.length

  const renderItem = (entry: VaultEntry, isPinned = false) => (
    <div
      key={entry.path}
      className={`note-list__item${isPinned ? ' note-list__item--pinned' : ''}${
        selectedNote?.path === entry.path ? ' note-list__item--selected' : ''
      }`}
      onClick={() => onSelectNote(entry)}
    >
      <div className="note-list__item-top">
        <div className="note-list__title">{entry.title}</div>
        <span className="note-list__date">{relativeDate(getDisplayDate(entry))}</span>
      </div>
      <div className="note-list__snippet">{getSnippet(allContent[entry.path])}</div>
      <div className="note-list__meta">
        {entry.isA && <span className={`note-list__type note-list__type--${entry.isA.toLowerCase()}`}>{entry.isA}</span>}
        {entry.status && <span className="note-list__status">{entry.status}</span>}
      </div>
    </div>
  )

  return (
    <div className="note-list">
      <div className="note-list__header" data-tauri-drag-region>
        <h3>{isEntityView ? selection.entry.title : 'Notes'}</h3>
        <div className="note-list__header-right">
          <span className="note-list__count">{totalCount}</span>
          <button className="note-list__add-btn" onClick={onCreateNote} title="Create new note">
            +
          </button>
        </div>
      </div>
      <div className="note-list__search">
        <input
          type="text"
          className="note-list__search-input"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!isEntityView && (
        <div className="note-list__pills">
          {TYPE_PILLS.filter(({ type }) => {
            const count = typeCounts.get(type) ?? 0
            return type === null || count > 0
          }).map(({ label, type }) => {
            const count = typeCounts.get(type) ?? 0
            return (
              <button
                key={label}
                className={`note-list__pill${typeFilter === type ? ' note-list__pill--active' : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {label} <span className="note-list__pill-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="note-list__items">
        {isEntityView ? (
          <>
            {renderItem(selection.entry, true)}
            {searchedGroups.length === 0 ? (
              <div className="note-list__empty">
                {query ? 'No matching items' : 'No related items'}
              </div>
            ) : (
              searchedGroups.map((group) => (
                <div key={group.label} className="note-list__group">
                  <div className="note-list__group-header">
                    <span className="note-list__group-label">{group.label}</span>
                    <span className="note-list__group-count">{group.entries.length}</span>
                  </div>
                  {group.entries.map((entry) => renderItem(entry))}
                </div>
              ))
            )}
          </>
        ) : (
          displayed.length === 0 ? (
            <div className="note-list__empty">No notes found</div>
          ) : (
            displayed.map((entry) => renderItem(entry))
          )
        )}
      </div>
    </div>
  )
}
