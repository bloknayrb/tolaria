import './Inspector.css'

interface InspectorProps {
  collapsed: boolean
  onToggle: () => void
}

export function Inspector({ collapsed, onToggle }: InspectorProps) {
  return (
    <aside className={`inspector ${collapsed ? 'inspector--collapsed' : ''}`}>
      <div className="inspector__header">
        <button className="inspector__toggle" onClick={onToggle}>
          {collapsed ? '\u25C0' : '\u25B6'}
        </button>
        {!collapsed && <h3>Inspector</h3>}
      </div>
      {!collapsed && (
        <div className="inspector__content">
          <div className="inspector__section">
            <h4>Properties</h4>
            <p className="inspector__empty">No note selected</p>
          </div>
          <div className="inspector__section">
            <h4>Relationships</h4>
            <p className="inspector__empty">No relationships</p>
          </div>
        </div>
      )}
    </aside>
  )
}
