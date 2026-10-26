import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ProfileDetail } from './ProfileDetail'
import {
  AUDIENCE_WIDENED,
  CompressionApiError,
  CompressionApiHook,
  ProfileDetail as ProfileDetailData,
  Version,
} from '../api'

// A profile made default after its version was approved deactivates that
// version. Serving it again - by activating it or by rolling back to it - is a
// new approval for the wider audience, so the server refuses the plain request
// and the screen has to ask, in a sentence, before resending it as one.

const version = (id: string, over: Partial<Version> = {}): Version => ({
  id,
  fidelity: 'reviewed',
  artifact_json_id: `json-${id}`,
  artifact_protobuf_id: '',
  artifact_json_size: 4096,
  artifact_json_wire_size: 2048,
  approved_under: { client_declarable: false, serve_as_default: false },
  approved_ratio: { json: 4 },
  ratio_measured: true,
  approved_by: 'alice',
  approved_at: '2026-10-25T10:00:00Z',
  activated_at: '2026-10-25T10:00:00Z',
  rollout_percent: 100,
  active: false,
  source_session_id: 's1',
  values_count: 2,
  ...over,
})

const profile: ProfileDetailData = {
  id: 'p1',
  name: 'feed',
  notes: '',
  client_declarable: false,
  serve_as_default: true,
  training_mode: 'values',
  revision: 2,
  active_version: null,
  created_at: '',
  updated_at: '',
  versions: [version('v2'), version('v1')],
}

const widened = new CompressionApiError(409, AUDIENCE_WIDENED, 'narrower')

const makeApi = (overrides: Partial<CompressionApiHook> = {}) => {
  const api = {
    getProfile: vi.fn().mockResolvedValue(profile),
    listSessions: vi.fn().mockResolvedValue({ sessions: [] }),
    getCompression: vi
      .fn()
      .mockResolvedValue({ enabled: true, structure_active: true }),
    activateVersion: vi
      .fn()
      .mockImplementation((_id: string, _p: number, confirm?: boolean) =>
        confirm ? Promise.resolve(version('v2')) : Promise.reject(widened)
      ),
    rollbackProfile: vi
      .fn()
      .mockImplementation((_id: string, confirm?: boolean) =>
        confirm ? Promise.resolve(version('v2')) : Promise.reject(widened)
      ),
    listVersionValues: vi.fn().mockResolvedValue({
      values: [
        {
          path: 'market.status',
          value: 'open',
          value_hash: 'h-open',
          occurrences: 10,
          witnesses: 5,
        },
        {
          path: 'user.email',
          value: 'a@b.c',
          value_hash: 'h-email',
          occurrences: 3,
          witnesses: 1,
        },
      ],
    }),
    denyVersionValues: vi.fn().mockResolvedValue(version('v3')),
    handleError: vi.fn(),
    ...overrides,
  }
  return api as unknown as CompressionApiHook & typeof api
}

const renderDetail = (api: CompressionApiHook) =>
  render(
    <MemoryRouter>
      <ProfileDetail
        api={api}
        profileId="p1"
        onBack={() => {}}
        onDeleted={() => {}}
      />
    </MemoryRouter>
  )

describe('ProfileDetail', () => {
  it('asks before serving a version to a wider audience, then confirms it', async () => {
    const api = makeApi()
    renderDetail(api)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Activate' }))[0]
    )
    fireEvent.click(await screen.findByRole('button', { name: /^activate$/i }))

    expect(
      await screen.findByText(
        /including connections belonging to other tenants/
      )
    ).toBeInTheDocument()
    expect(api.activateVersion).toHaveBeenCalledWith('v2', 100, false)

    fireEvent.click(screen.getByRole('button', { name: 'Approve and serve' }))
    await waitFor(() =>
      expect(api.activateVersion).toHaveBeenLastCalledWith('v2', 100, true)
    )
    expect(api.handleError).not.toHaveBeenCalled()
  })

  it('holds a rollback onto a narrower approval to the same question', async () => {
    const api = makeApi()
    renderDetail(api)
    fireEvent.click(await screen.findByRole('button', { name: 'Rollback' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Rollback' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve and serve' })
    )
    await waitFor(() =>
      expect(api.rollbackProfile).toHaveBeenLastCalledWith('p1', true)
    )
  })

  it('withdraws a field from a version whole', async () => {
    const api = makeApi()
    renderDetail(api)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Values (2)' }))[0]
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Deny user.email = a@b.c' })
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /deny every value of/i })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw 1 value' }))
    await waitFor(() =>
      expect(api.denyVersionValues).toHaveBeenCalledWith('v2', {
        denied: [],
        denied_fields: ['user.email'],
      })
    )
  })
})
