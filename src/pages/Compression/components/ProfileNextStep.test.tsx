import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

import { nextStep } from './ProfileNextStep'
import { CreateSessionDialog } from './CreateSessionDialog'
import { ProfileDetail, Session, Version } from '../api'

const version = (over: Partial<Version>): Version =>
  ({
    id: 'v',
    active: false,
    rollout_percent: 0,
    approved_at: '2026-10-01T00:00:00Z',
    source_session_id: '',
    ...over,
  }) as Version

const profile = (versions: Version[]): ProfileDetail =>
  ({ id: 'p1', name: 'feed', versions }) as unknown as ProfileDetail

const session = (over: Partial<Session>): Session =>
  ({
    id: 's1',
    status: 'collected',
    training_mode: 'schema',
    filter: {},
    started_at: '2026-10-25T10:00:00Z',
    deadline: '2026-10-25T10:30:00Z',
    profile_id: 'p1',
    ...over,
  }) as Session

describe('nextStep', () => {
  it('starts with training', () => {
    expect(nextStep(profile([]), [], true).action).toEqual({
      kind: 'start_training',
    })
  })

  it('follows a session in progress before anything else', () => {
    const s = nextStep(
      profile([version({ active: true, rollout_percent: 100 })]),
      [session({ status: 'running' })],
      true
    )
    expect(s.title).toBe('Training in progress')
    expect(s.action).toEqual({ kind: 'open_session', sessionId: 's1' })
  })

  it('leads a finished session to its decision, until a version comes from it', () => {
    const finished = session({ training_mode: 'values' })
    expect(nextStep(profile([]), [finished], true).title).toBe(
      'Training finished: values to review'
    )
    const ready = nextStep(
      profile([version({ id: 'v1', source_session_id: 's1' })]),
      [finished],
      true
    )
    expect(ready.action).toEqual({
      kind: 'activate',
      version: expect.objectContaining({ id: 'v1' }),
    })
  })

  it('says when a finished session saw nothing', () => {
    const s = nextStep(
      profile([]),
      [session({ progress: { frames_observed: 0 } as Session['progress'] })],
      true
    )
    expect(s.title).toBe('Training saw no traffic')
    expect(s.action).toEqual({ kind: 'start_training' })
  })

  it('offers the newest inactive version to activate', () => {
    const s = nextStep(
      profile([
        version({ id: 'old', approved_at: '2026-09-01T00:00:00Z' }),
        version({ id: 'new', approved_at: '2026-10-01T00:00:00Z' }),
      ]),
      [],
      true
    )
    expect(s.action).toEqual({
      kind: 'activate',
      version: expect.objectContaining({ id: 'new' }),
    })
  })

  it('widens a staged rollout, then offers retraining from the source session', () => {
    expect(
      nextStep(
        profile([version({ active: true, rollout_percent: 10 })]),
        [],
        true
      ).title
    ).toBe('Rolling out to 10% of connections')
    expect(
      nextStep(
        profile([
          version({
            active: true,
            rollout_percent: 100,
            source_session_id: 's9',
          }),
        ]),
        [],
        true
      ).action
    ).toEqual({ kind: 'retrain', sessionId: 's9' })
  })

  it('says when nothing is served at all', () => {
    expect(nextStep(profile([]), [], false).paused).toBe(true)
  })
})

describe('CreateSessionDialog', () => {
  it('trains on shapes only unless asked otherwise', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CreateSessionDialog open onClose={() => {}} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].training_mode).toBe('schema')
  })

  it('starts a retrain from the previous session', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateSessionDialog
        open
        onClose={() => {}}
        onSubmit={onSubmit}
        profiles={[{ id: 'p1', name: 'feed' }]}
        initial={{
          filter: { channel: 'odds:*', profile: 'feed' },
          training_mode: 'values',
          duration_seconds: 1800,
          profile_id: 'p1',
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({
      filter: { channel: 'odds:*', profile: 'feed' },
      training_mode: 'values',
      duration_seconds: 1800,
      profile_id: 'p1',
    })
  })
})
