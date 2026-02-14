import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { Editor } from './components/Editor'
import { Inspector } from './components/Inspector'
import { ResizeHandle } from './components/ResizeHandle'
import './App.css'

interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  owner: string | null
  cadence: string | null
  modifiedAt: number | null
  fileSize: number
}

// TODO: Make vault path configurable via settings
const TEST_VAULT_PATH = '~/vault'

function App() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [noteListWidth, setNoteListWidth] = useState(300)
  const [inspectorWidth, setInspectorWidth] = useState(280)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)

  useEffect(() => {
    // Expand ~ to home directory for the test path
    const path = TEST_VAULT_PATH.replace('~', '/Users/' + (import.meta.env.VITE_USER || 'user'))

    invoke<VaultEntry[]>('list_vault', { path })
      .then((result) => {
        console.log(`Vault scan complete: ${result.length} entries found`, result)
        setEntries(result)
      })
      .catch((err) => {
        console.warn('Vault scan failed (expected if no vault at path):', err)
      })
  }, [])

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(150, Math.min(400, w + delta)))
  }, [])

  const handleNoteListResize = useCallback((delta: number) => {
    setNoteListWidth((w) => Math.max(200, Math.min(500, w + delta)))
  }, [])

  const handleInspectorResize = useCallback((delta: number) => {
    // Inspector resize is inverted: dragging left makes it wider
    setInspectorWidth((w) => Math.max(200, Math.min(500, w - delta)))
  }, [])

  return (
    <div className="app">
      <div className="app__sidebar" style={{ width: sidebarWidth }}>
        <Sidebar />
      </div>
      <ResizeHandle onResize={handleSidebarResize} />
      <div className="app__note-list" style={{ width: noteListWidth }}>
        <NoteList entries={entries} />
      </div>
      <ResizeHandle onResize={handleNoteListResize} />
      <div className="app__editor">
        <Editor />
      </div>
      {!inspectorCollapsed && <ResizeHandle onResize={handleInspectorResize} />}
      <div
        className="app__inspector"
        style={{ width: inspectorCollapsed ? 40 : inspectorWidth }}
      >
        <Inspector
          collapsed={inspectorCollapsed}
          onToggle={() => setInspectorCollapsed((c) => !c)}
        />
      </div>
    </div>
  )
}

export default App
