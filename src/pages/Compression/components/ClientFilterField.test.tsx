import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'

import { ClientFilterField } from './ClientFilterField'
import { ClientFilter } from '../api'

const all: ClientFilter = { mode: 'all', clients: [] }

const setUp = (value: ClientFilter = all) => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<ClientFilterField value={value} disabled={false} onSave={onSave} />)
  return onSave
}

const chooseMode = (label: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Serve to' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

const addName = (label: string) => {
  const input = screen.getByRole('combobox', { name: 'Client names' })
  fireEvent.mouseDown(input)
  fireEvent.click(screen.getByRole('option', { name: label }))
}

describe('ClientFilterField', () => {
  afterEach(() => vi.restoreAllMocks())

  it('offers nothing to apply until something changes', () => {
    setUp()
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
  })

  it('applies an exclusion as a draft', async () => {
    const onSave = setUp()
    chooseMode('All except')
    addName('dart')
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        mode: 'except',
        clients: [{ name: 'dart' }],
      })
    )
  })

  it('stores a client with no name as the empty name', async () => {
    const onSave = setUp()
    chooseMode('All except')
    addName('no name')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        mode: 'except',
        clients: [{ name: '' }],
      })
    )
  })

  it('does not carry a list over to the other mode', async () => {
    const onSave = setUp({ mode: 'only', clients: [{ name: 'js' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    chooseMode('All except')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ mode: 'except', clients: [] })
    )
  })

  it('asks before serving nobody', () => {
    const onSave = setUp()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    chooseMode('Only')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(confirm).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancel puts back what is stored', () => {
    setUp({ mode: 'except', clients: [{ name: 'dart' }] })
    chooseMode('All clients')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('dart')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
  })
})
