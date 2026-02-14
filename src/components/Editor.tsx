import './Editor.css'

export function Editor() {
  return (
    <div className="editor">
      <div className="editor__placeholder">
        <p>Select a note to start editing</p>
        <p className="editor__hint">CodeMirror 6 editor will be integrated here</p>
      </div>
    </div>
  )
}
