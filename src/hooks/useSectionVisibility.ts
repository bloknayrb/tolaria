import { useState, useCallback } from 'react'

const STORAGE_KEY = 'laputa-hidden-sections'

function loadHiddenSections(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch {
    // ignore corrupt data
  }
  return new Set()
}

function saveHiddenSections(hidden: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]))
}

export function useSectionVisibility() {
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(loadHiddenSections)

  const toggleSection = useCallback((type: string) => {
    setHiddenSections((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      saveHiddenSections(next)
      return next
    })
  }, [])

  const isSectionVisible = useCallback(
    (type: string) => !hiddenSections.has(type),
    [hiddenSections],
  )

  return { hiddenSections, toggleSection, isSectionVisible }
}
