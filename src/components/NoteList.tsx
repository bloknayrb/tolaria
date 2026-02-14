import './NoteList.css'

interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  status: string | null
  modifiedAt: number | null
}

interface NoteListProps {
  entries: VaultEntry[]
}

export function NoteList({ entries }: NoteListProps) {
  return (
    <div className="note-list">
      <div className="note-list__header">
        <h3>Notes</h3>
        <span className="note-list__count">{entries.length}</span>
      </div>
      <div className="note-list__items">
        {entries.length === 0 ? (
          <div className="note-list__empty">No notes loaded</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.path} className="note-list__item">
              <div className="note-list__title">{entry.title}</div>
              <div className="note-list__meta">
                {entry.isA && <span className="note-list__type">{entry.isA}</span>}
                {entry.status && <span className="note-list__status">{entry.status}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
