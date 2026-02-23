import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock isTauri — default to browser mode
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

import { pickFolder } from './vault-dialog'
import { isTauri } from '../mock-tauri'

describe('pickFolder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns user input from prompt in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue('/Users/test/my-vault')

    const result = await pickFolder('Select vault')
    expect(result).toBe('/Users/test/my-vault')
    expect(window.prompt).toHaveBeenCalledWith('Select vault')
  })

  it('returns null when user cancels prompt in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue(null)

    const result = await pickFolder('Select vault')
    expect(result).toBeNull()
  })

  it('uses default title when none provided in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue('/some/path')

    await pickFolder()
    expect(window.prompt).toHaveBeenCalledWith('Enter folder path:')
  })
})
