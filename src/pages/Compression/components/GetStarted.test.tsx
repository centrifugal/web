import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

import { GetStarted } from './GetStarted'
import { CompressionApiHook, CompressionOverview } from '../api'

const empty: CompressionOverview = {
  enabled: false,
  structure_active: false,
  profiles: 0,
  active_versions: 0,
}

const makeApi = (overrides: Partial<CompressionApiHook> = {}) => {
  const api = {
    setCompressionEnabled: vi.fn().mockResolvedValue({}),
    setStructureActive: vi.fn().mockResolvedValue({}),
    createProfile: vi.fn().mockResolvedValue({ id: 'p1' }),
    createSession: vi.fn().mockResolvedValue({ id: 's1' }),
    handleError: vi.fn(),
    ...overrides,
  }
  return api as unknown as CompressionApiHook & typeof api
}

const setUp = async (api: CompressionApiHook, overview = empty) => {
  const onStarted = vi.fn()
  const onChanged = vi.fn()
  render(
    <GetStarted
      api={api}
      overview={overview}
      onStarted={onStarted}
      onChanged={onChanged}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(
    Array.from(dialog.querySelectorAll('button')).find(
      b => b.textContent === 'Set up'
    ) as HTMLButtonElement
  )
  return { onStarted, onChanged }
}

describe('GetStarted', () => {
  it('runs the listed steps and opens the training session', async () => {
    const api = makeApi()
    const { onStarted } = await setUp(api)
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('s1'))
    expect(api.setCompressionEnabled).toHaveBeenCalledWith(true)
    expect(api.setStructureActive).toHaveBeenCalledWith(true)
    expect(api.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'default',
        serve_as_default: true,
        client_declarable: false,
      })
    )
    expect(api.createSession).toHaveBeenCalledWith({
      filter: {},
      training_mode: 'schema',
      duration_seconds: 1800,
      profile_id: 'p1',
    })
  })

  it('leaves switches that are already on alone', async () => {
    const api = makeApi()
    const { onStarted } = await setUp(api, {
      ...empty,
      enabled: true,
      structure_active: true,
    })
    await waitFor(() => expect(onStarted).toHaveBeenCalled())
    expect(api.setCompressionEnabled).not.toHaveBeenCalled()
    expect(api.setStructureActive).not.toHaveBeenCalled()
  })

  it('reports a failed step and stops there', async () => {
    const failure = new Error('db down')
    const api = makeApi({
      createProfile: vi.fn().mockRejectedValue(failure),
    } as Partial<CompressionApiHook>)
    const { onStarted, onChanged } = await setUp(api)
    await waitFor(() => expect(api.handleError).toHaveBeenCalledWith(failure))
    expect(api.createSession).not.toHaveBeenCalled()
    expect(onStarted).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalled()
  })
})
