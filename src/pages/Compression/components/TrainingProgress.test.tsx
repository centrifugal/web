import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { TrainingProgress } from './TrainingProgress'
import { Session, SessionProgress } from '../api'

const minutes = (n: number) => n * 60 * 1000

const progress = (over: Partial<SessionProgress> = {}): SessionProgress =>
  ({
    frames_observed: 9012,
    bytes_observed: 1000,
    connections_sampled: 4,
    connections_matched: 4,
    effective_cap: 50,
    distinct_users: 4,
    distinct_shapes: 2,
    distinct_keys: 7,
    distinct_values: 2767,
    by_protocol: { json: 9012 },
    by_frame_type: { publication: 9000 },
    channel_frames: {},
    unparseable_by_channel: {},
    payload_parse_rate: 1,
    held_back_frames: 0,
    last_new_shape_at: null,
    denied: null,
    ratio_by_protocol: null,
    size_curve: null,
    warmup_complete: true,
    ...over,
  }) as SessionProgress

// A 40-minute session started `ago` minutes ago: its last quarter, the
// measuring part, starts at minute 30.
const session = (ago: number, over: Partial<Session> = {}): Session =>
  ({
    id: 's1',
    status: 'running',
    training_mode: 'schema',
    filter: {},
    started_at: new Date(Date.now() - minutes(ago)).toISOString(),
    deadline: new Date(Date.now() - minutes(ago) + minutes(40)).toISOString(),
    stopped_at: null,
    ...over,
  }) as Session

describe('TrainingProgress', () => {
  it('shows the training set filling before the measuring part', () => {
    render(<TrainingProgress session={session(10)} progress={progress()} />)
    expect(
      screen.getByText(/9,012 frames from 4 connections, until/)
    ).toBeInTheDocument()
    expect(screen.getByText(/^from /)).toBeInTheDocument()
  })

  it('counts what is held back once measuring starts', () => {
    render(
      <TrainingProgress
        session={session(35)}
        progress={progress({ held_back_frames: 2719 })}
      />
    )
    expect(screen.getByText('2,719 frames')).toBeInTheDocument()
  })

  it('says when a stopped session never reached the measuring part', () => {
    const s = session(20, {
      status: 'collected',
      stopped_at: new Date(Date.now() - minutes(5)).toISOString(),
    })
    render(<TrainingProgress session={s} progress={progress()} />)
    expect(screen.getByText('not reached: stopped early')).toBeInTheDocument()
  })

  it('says the message types look covered once no new shape has come for a while', () => {
    render(
      <TrainingProgress
        session={session(10)}
        progress={progress({
          last_new_shape_at: new Date(Date.now() - minutes(3)).toISOString(),
        })}
      />
    )
    expect(screen.getByText(/look covered/)).toBeInTheDocument()
  })

  it('does not on idle connections, where no new shape means no traffic', () => {
    render(
      <TrainingProgress
        session={session(25)}
        progress={progress({
          frames_observed: 40,
          warmup_complete: false,
          last_new_shape_at: new Date(Date.now() - minutes(10)).toISOString(),
        })}
      />
    )
    expect(screen.queryByText(/look covered/)).toBeNull()
    expect(screen.getByText(/Only 40 frames so far/)).toBeInTheDocument()
  })

  it('does not yet while shapes keep coming', () => {
    render(
      <TrainingProgress
        session={session(10)}
        progress={progress({
          last_new_shape_at: new Date(Date.now() - 10000).toISOString(),
        })}
      />
    )
    expect(screen.queryByText(/look covered/)).toBeNull()
  })

  it('counts values refused before collection in a values session', () => {
    render(
      <TrainingProgress
        session={session(10, { training_mode: 'values' })}
        progress={progress({ denied: { shape: 9, name: 2 } })}
      />
    )
    expect(screen.getByText('refused 11 times')).toBeInTheDocument()
  })
})
