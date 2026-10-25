import Alert, { AlertColor } from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'

import { ProfileDetail, Session, Version } from '../api'
import { fmtDateTime } from '../format'

export type NextAction =
  | { kind: 'start_training' }
  | { kind: 'open_session'; sessionId: string }
  | { kind: 'activate'; version: Version }
  | { kind: 'retrain'; sessionId: string }

export interface NextStep {
  severity: AlertColor
  title: string
  body: string
  action: NextAction
  actionLabel: string
  // Shown when the deployment switch is off, whatever the step: everything
  // below describes what this profile would serve.
  paused: boolean
}

const newest = (versions: Version[]): Version | undefined =>
  [...versions].sort(
    (a, b) => Date.parse(b.approved_at) - Date.parse(a.approved_at)
  )[0]

// nextStep says where a profile stands and the one thing to do next. Training
// in progress or waiting for a decision comes first: it is the step the
// operator started and has not finished. Otherwise it follows the version:
// none, ready but inactive, rolling out, serving.
//
// sessions is the newest first list of sessions trained for this profile.
// structureActive says what connections get while the profile serves no
// dictionary of its own: the structure dictionary, or nothing.
export const nextStep = (
  profile: ProfileDetail,
  sessions: Session[],
  servingEnabled: boolean,
  structureActive = false
): NextStep => {
  const paused = !servingEnabled
  const latest = sessions[0]
  const active = profile.versions.find(v => v.active)
  const fromLatest =
    latest && profile.versions.some(v => v.source_session_id === latest.id)

  if (latest?.status === 'running') {
    return {
      severity: 'info',
      title: 'Training in progress',
      body: `Collecting traffic until ${fmtDateTime(latest.deadline)}. When it ends, its dictionary is built and this page says what to do with it.`,
      action: { kind: 'open_session', sessionId: latest.id },
      actionLabel: 'Open session',
      paused,
    }
  }
  if (latest?.status === 'collected' && !fromLatest) {
    const meanwhile = active
      ? 'Until then the profile keeps serving its current dictionary.'
      : structureActive
        ? 'Until then its connections get the structure dictionary.'
        : 'Until then its connections get no dictionary.'
    return latest.training_mode === 'values'
      ? {
          severity: 'warning',
          title: 'Training finished: values to review',
          body: `Approve the values that may be shown to every client this profile reaches. ${meanwhile}`,
          action: { kind: 'open_session', sessionId: latest.id },
          actionLabel: 'Open session',
          paused,
        }
      : {
          severity: 'warning',
          title: 'Training finished',
          body: `The session learned field names and message shapes only, so there is nothing to review. Open it to create the dictionary. ${meanwhile}`,
          action: { kind: 'open_session', sessionId: latest.id },
          actionLabel: 'Open session',
          paused,
        }
  }
  if (latest?.status === 'failed' && !active) {
    return {
      severity: 'error',
      title: 'Training failed',
      body: latest.error_message || 'The last training session failed.',
      action: { kind: 'start_training' },
      actionLabel: 'Start training',
      paused,
    }
  }
  if (profile.versions.length === 0) {
    return {
      severity: 'info',
      title: 'Not trained yet',
      body: 'Start a training session over this profile’s connections. Training on field names and shapes only needs no review.',
      action: { kind: 'start_training' },
      actionLabel: 'Start training',
      paused,
    }
  }
  if (!active) {
    const version = newest(profile.versions) as Version
    return {
      severity: 'warning',
      title: 'A dictionary is ready',
      body: 'It serves nothing until you activate it.',
      action: { kind: 'activate', version },
      actionLabel: 'Activate',
      paused,
    }
  }
  if (active.rollout_percent < 100) {
    return {
      severity: 'info',
      title: `Rolling out to ${active.rollout_percent}% of connections`,
      body: 'Compare what it saves on Overview, then widen the rollout.',
      action: { kind: 'activate', version: active },
      actionLabel: 'Change rollout',
      paused,
    }
  }
  return {
    severity: 'success',
    title: 'Serving',
    body: 'New connections of this profile receive this dictionary, and open ones get it when they reconnect. Retrain when your messages change.',
    action: active.source_session_id
      ? { kind: 'retrain', sessionId: active.source_session_id }
      : { kind: 'start_training' },
    actionLabel: 'Retrain',
    paused,
  }
}

interface ProfileNextStepProps {
  step: NextStep
  canChange: boolean
  onAction: (action: NextAction) => void
}

// ProfileNextStep: where the profile stands, in one sentence, with the one
// action that moves it on.
export const ProfileNextStep = ({
  step,
  canChange,
  onAction,
}: ProfileNextStepProps) => {
  // Opening a session is reading; everything else changes something.
  const allowed = canChange || step.action.kind === 'open_session'
  return (
    <Alert
      severity={step.paused ? 'warning' : step.severity}
      action={
        allowed ? (
          <Button
            color="inherit"
            size="small"
            onClick={() => onAction(step.action)}
          >
            {step.actionLabel}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{step.title}</AlertTitle>
      {step.body}
      {step.paused &&
        ' Serve dictionaries is off on Overview, so no connection receives any dictionary right now.'}
    </Alert>
  )
}
