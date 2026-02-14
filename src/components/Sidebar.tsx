import './Sidebar.css'

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2>Laputa</h2>
      </div>
      <nav className="sidebar__nav">
        <div className="sidebar__item sidebar__item--active">All Notes</div>
        <div className="sidebar__item">Projects</div>
        <div className="sidebar__item">Tasks</div>
        <div className="sidebar__item">People</div>
      </nav>
    </aside>
  )
}
