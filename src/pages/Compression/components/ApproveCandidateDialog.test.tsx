import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

import { ApproveCandidateDialog } from './ApproveCandidateDialog'
import { AssignCandidateDialog } from './AssignCandidateDialog'
import { Candidate, CompressionApiHook, Profile, Version } from '../api'

// Approving creates a version and, unless asked, does nothing else: activating
// stays a separate decision, so "Activate now" must be off on every opening and
// the version left inactive. The profile the session was trained for is
// preselected, and an id naming no profile any more is not.

const profile = (id: string, name: string): Profile => ({
  id,
  name,
  notes: '',
  client_declarable: false,
  serve_as_default: false,
  training_mode: 'schema',
  revision: 1,
  active_version: null,
  created_at: '',
  updated_at: '',
})

const makeApi = (overrides: Partial<CompressionApiHook> = {}) => {
  const api = {
    listProfiles: vi.fn().mockResolvedValue({
      profiles: [profile('p1', 'feed'), profile('p2', 'odds')],
    }),
    previewCandidate: vi.fn().mockRejectedValue(new Error('no preview')),
    approveCandidate: vi.fn().mockResolvedValue({ id: 'v1' } as Version),
    assignSession: vi.fn().mockResolvedValue({ id: 'v2' } as Version),
    activateVersion: vi
      .fn()
      .mockImplementation((_id: string, percent: number) =>
        Promise.resolve({ id: 'v1', rollout_percent: percent } as Version)
      ),
    handleError: vi.fn(),
    ...overrides,
  }
  return api as unknown as CompressionApiHook & typeof api
}

const renderApprove = (api: CompressionApiHook, defaultProfileId?: string) => {
  const onApproved = vi.fn()
  render(
    <ApproveCandidateDialog
      api={api}
      open
      candidateId="c1"
      approvedHashes={['h1']}
      totalValues={1}
      sizeBytes={4096}
      defaultProfileId={defaultProfileId}
      onClose={() => {}}
      onApproved={onApproved}
    />
  )
  return onApproved
}

const profileSelect = () =>
  screen.getByRole('combobox', { name: /target profile/i })

describe('ApproveCandidateDialog', () => {
  it('preselects the session profile and leaves the version inactive', async () => {
    const api = makeApi()
    const onApproved = renderApprove(api, 'p2')
    await waitFor(() => expect(profileSelect().textContent).toContain('odds'))
    expect(
      screen.getByRole('checkbox', { name: /activate now/i })
    ).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(onApproved).toHaveBeenCalled())
    expect(api.approveCandidate).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ profile_id: 'p2' })
    )
    expect(api.activateVersion).not.toHaveBeenCalled()
    expect(onApproved).toHaveBeenCalledWith({
      profileId: 'p2',
      versionId: 'v1',
      activatedPercent: null,
    })
  })

  it('activates at the chosen percent when asked', async () => {
    const api = makeApi()
    const onApproved = renderApprove(api, 'p1')
    await waitFor(() => expect(profileSelect().textContent).toContain('feed'))
    fireEvent.click(screen.getByRole('checkbox', { name: /activate now/i }))
    fireEvent.change(
      screen.getByRole('spinbutton', { name: /rollout percent/i }),
      {
        target: { value: '25' },
      }
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Approve and activate' })
    )
    await waitFor(() => expect(onApproved).toHaveBeenCalled())
    expect(api.activateVersion).toHaveBeenCalledWith('v1', 25)
    expect(onApproved).toHaveBeenCalledWith({
      profileId: 'p1',
      versionId: 'v1',
      activatedPercent: 25,
    })
  })

  it('reports the version, then the error, when activation fails', async () => {
    const failure = new Error('activation failed')
    const api = makeApi({
      activateVersion: vi.fn().mockRejectedValue(failure),
    } as Partial<CompressionApiHook>)
    const onApproved = renderApprove(api, 'p1')
    await waitFor(() => expect(profileSelect().textContent).toContain('feed'))
    fireEvent.click(screen.getByRole('checkbox', { name: /activate now/i }))

    fireEvent.click(
      screen.getByRole('button', { name: 'Approve and activate' })
    )
    await waitFor(() => expect(api.handleError).toHaveBeenCalledWith(failure))
    expect(onApproved).toHaveBeenCalledWith({
      profileId: 'p1',
      versionId: 'v1',
      activatedPercent: null,
    })
  })

  it('does not preselect a profile that no longer exists', async () => {
    const api = makeApi()
    renderApprove(api, 'deleted')
    await waitFor(() => expect(api.listProfiles).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
    )
    expect(profileSelect().textContent).not.toContain('feed')
  })
})

describe('AssignCandidateDialog', () => {
  const candidate = {
    id: 'c2',
    fidelity: 'schema',
    size_curve: [],
    recommended_size: 2048,
  } as unknown as Candidate

  it('preselects the session profile and activates only when asked', async () => {
    const api = makeApi()
    const onAssigned = vi.fn()
    render(
      <AssignCandidateDialog
        api={api}
        sessionId="s1"
        candidate={candidate}
        defaultProfileId="p1"
        onClose={() => {}}
        onAssigned={onAssigned}
      />
    )
    await waitFor(() => expect(profileSelect().textContent).toContain('feed'))
    expect(
      screen.getByRole('checkbox', { name: /activate now/i })
    ).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(onAssigned).toHaveBeenCalled())
    expect(api.assignSession).toHaveBeenCalledWith('s1', {
      profile_id: 'p1',
      size_bytes: 2048,
    })
    expect(api.activateVersion).not.toHaveBeenCalled()
    expect(onAssigned).toHaveBeenCalledWith({
      profileId: 'p1',
      versionId: 'v2',
      activatedPercent: null,
    })
  })
})
