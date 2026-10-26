import { useCallback, useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UndoIcon from '@mui/icons-material/Undo'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

import { useSearchParams } from 'react-router-dom'

import { ShellContext } from 'contexts/ShellContext'
import { useCan } from 'contexts/SessionContext'
import { Panel, CapabilityChip, InlineStat } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'
import { ConfirmButton } from 'components/ConfirmButton'
import { HumanSize } from 'utils/Functions'

import {
  AUDIENCE_WIDENED,
  CompressionApiHook,
  CompressionApiError,
  ProfileDetail as ProfileDetailData,
  ProfilePatch,
  Session,
  Version,
} from '../api'
import { fmtDateTime, fmtTrainingMode } from '../format'
import { ExpectedRatio } from './ExpectedRatio'
import { EditProfileDialog } from './EditProfileDialog'
import { ActivateVersionDialog } from './ActivateVersionDialog'
import { AudienceConfirmDialog } from './AudienceConfirmDialog'
import { VersionValuesDialog } from './VersionValuesDialog'
import { NextAction, nextStep, ProfileNextStep } from './ProfileNextStep'
import { ProfileAssignment } from './ProfileAssignment'

interface ProfileDetailProps {
  api: CompressionApiHook
  profileId: string
  onBack: () => void
  onDeleted: () => void
}

// ProfileDetail: a single profile's full record — its audience flags and its
// version history. Kept as an in-tab panel switch (not a route) so it shares
// the Profiles tab's URL and doesn't need its own navigation entry.
// Activate and Deactivate occupy the same cell in different rows, and sizing
// each to its own label steps the column in and out by the width of two
// characters. One width for both keeps the edge straight however the rows are
// mixed.
//
// It has to clear the LONGER label, not sit between them: buttons render
// uppercase with letter-spacing (see theme.ts), so DEACTIVATE lays out around
// 109px and the previous 104 pinned ACTIVATE while DEACTIVATE grew past it -
// the two ended up different widths despite sharing this.
const versionActionSx = { minWidth: 124, whiteSpace: 'nowrap' as const }

export const ProfileDetail = ({
  api,
  profileId,
  onBack,
  onDeleted,
}: ProfileDetailProps) => {
  const { showAlert } = useContext(ShellContext)
  const [profile, setProfile] = useState<ProfileDetailData | null>(null)
  const [, setSearchParams] = useSearchParams()

  // Leaves this profile for the Training tab with the create dialog already
  // bound to it. The operator's next step from an empty profile is a training
  // session, and it is two tabs away otherwise.
  const startTraining = (retrainFrom?: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'sessions')
      next.delete('profile')
      next.set('train_for', profileId)
      if (retrainFrom) next.set('retrain_from', retrainFrom)
      return next
    })
  }
  const openSession = (sessionId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'sessions')
      next.delete('profile')
      next.set('session', sessionId)
      return next
    })
  }
  const canChange = useCan('ops:write')
  // A version's values are channel content, like a candidate's.
  const canReadValues = useCan('channels:read')
  // Sessions trained for this profile, newest first, and whether anything is
  // served at all: what the next step is depends on both.
  const [sessions, setSessions] = useState<Session[]>([])
  const [servingEnabled, setServingEnabled] = useState(true)
  const [structureActive, setStructureActive] = useState(false)
  useEffect(() => {
    let cancelled = false
    api
      .listSessions({ limit: 50 })
      .then(data => {
        if (!cancelled)
          setSessions(
            (data.sessions || []).filter(s => s.profile_id === profileId)
          )
      })
      .catch(() => {})
    api
      .getCompression()
      .then(o => {
        if (!cancelled) {
          setServingEnabled(o.enabled)
          setStructureActive(o.structure_active)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [activateTarget, setActivateTarget] = useState<Version | null>(null)
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [valuesTarget, setValuesTarget] = useState<Version | null>(null)
  // What a version is beyond serving it - its values, its dictionary ids -
  // is one menu away rather than a column on every row.
  const [versionMenu, setVersionMenu] = useState<{
    anchor: HTMLElement
    version: Version
  } | null>(null)
  const copyId = (id: string) => {
    navigator.clipboard
      ?.writeText(id)
      .then(() => showAlert('Copied', { severity: 'success' }))
      .catch(() => showAlert(id, { severity: 'info' }))
  }
  // An activation or rollback the server refused because the version was
  // approved for a narrower audience than the profile now reaches; confirming
  // resends it as an approval for the wider one.
  const [audiencePending, setAudiencePending] = useState<
    | { kind: 'activate'; versionId: string; rolloutPercent: number }
    | { kind: 'rollback' }
    | null
  >(null)
  const audienceWidened = (err: unknown) =>
    err instanceof CompressionApiError && err.code === AUDIENCE_WIDENED

  const load = useCallback(async () => {
    try {
      const data = await api.getProfile(profileId)
      setProfile(data)
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api, profileId])

  useEffect(() => {
    load()
  }, [load])

  const handleEditSubmit = async (patch: ProfilePatch) => {
    if (!profile) return
    try {
      const updated = await api.updateProfile(profile.id, {
        ...patch,
        revision: profile.revision,
      })
      setEditOpen(false)
      if (updated.invalidated_version_id) {
        showAlert(
          'Saved. The active version was deactivated because this widened its audience — it needs re-approval before it serves again.',
          { severity: 'warning' }
        )
      } else {
        showAlert('Profile updated', { severity: 'success' })
      }
      load()
    } catch (err) {
      if (err instanceof CompressionApiError && err.code === 'conflict') {
        showAlert(
          'This profile changed since you loaded it, so nothing was overwritten. Reloading the latest version — please redo your edit.',
          { severity: 'warning' }
        )
        setEditOpen(false)
        load()
        return
      }
      api.handleError(err)
    }
  }

  const handleActivate = async (
    versionId: string,
    rolloutPercent: number,
    confirmAudience = false
  ) => {
    try {
      await api.activateVersion(versionId, rolloutPercent, confirmAudience)
      showAlert('Version activated', { severity: 'success' })
      setActivateTarget(null)
      setAudiencePending(null)
      load()
    } catch (err) {
      if (audienceWidened(err)) {
        setActivateTarget(null)
        setAudiencePending({ kind: 'activate', versionId, rolloutPercent })
        return
      }
      if (err instanceof CompressionApiError && err.code === 'conflict') {
        showAlert(
          `Another activation won the race before this one landed: ${err.message}`,
          { severity: 'warning' }
        )
        setActivateTarget(null)
        load()
        return
      }
      api.handleError(err)
    }
  }

  const handleDeactivate = async (versionId: string) => {
    setBusyVersionId(versionId)
    try {
      await api.deactivateVersion(versionId)
      showAlert('Version deactivated', { severity: 'success' })
      load()
    } catch (err) {
      api.handleError(err)
    } finally {
      setBusyVersionId(null)
    }
  }

  const handleRollback = async (confirmAudience = false) => {
    if (!profile) return
    setRollbackBusy(true)
    try {
      await api.rollbackProfile(profile.id, confirmAudience)
      showAlert('Rolled back to the previous version', { severity: 'success' })
      setAudiencePending(null)
      load()
    } catch (err) {
      if (audienceWidened(err)) {
        setAudiencePending({ kind: 'rollback' })
        return
      }
      api.handleError(err)
    } finally {
      setRollbackBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!profile) return
    try {
      await api.deleteProfile(profile.id)
      showAlert('Profile deleted', { severity: 'success' })
      onDeleted()
    } catch (err) {
      api.handleError(err)
    }
  }

  const handleNextAction = (action: NextAction) => {
    switch (action.kind) {
      case 'start_training':
        startTraining()
        break
      case 'retrain':
        startTraining(action.sessionId)
        break
      case 'open_session':
        openSession(action.sessionId)
        break
      case 'activate':
        setActivateTarget(action.version)
        break
    }
  }

  if (loading && !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress disableShrink />
      </Box>
    )
  }

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="error">
          Failed to load this profile. It may have been deleted.
        </Alert>
        <Button
          variant="tonal"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back to profiles
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="tonal"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
        >
          Back to profiles
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {profile.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="tonal"
          color="inherit"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        <ConfirmButton
          title={`Delete ${profile.name}?`}
          body={`This removes the profile and its version history. Rejections recorded against the name "${profile.name}" survive deletion — recreating a profile with this name inherits them, so previously-denied values won't be proposed again from scratch.`}
          confirmText="Delete"
          onConfirm={handleDelete}
        >
          {open => (
            <Button
              variant="tonal"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={open}
            >
              Delete
            </Button>
          )}
        </ConfirmButton>
      </Box>

      <ProfileNextStep
        step={nextStep(profile, sessions, servingEnabled, structureActive)}
        canChange={canChange}
        onAction={handleNextAction}
      />

      <Panel title="Profile" subtitle={profile.notes || undefined}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Who gets this profile
        </Typography>
        <ProfileAssignment profile={profile} />
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 3,
            rowGap: 1,
          }}
        >
          {profile.active_version && (
            <InlineStat label="Contents">
              <Typography variant="body2">
                {fmtTrainingMode(profile.training_mode)}
              </Typography>
            </InlineStat>
          )}
          <InlineStat label="Serving now">
            <Tooltip
              title={
                profile.connections != null
                  ? 'Connections currently being served a dictionary under ' +
                    'this profile, across the cluster. Connections classified ' +
                    'here but served nothing - while Serve dictionaries is ' +
                    'off, for instance - are not counted.'
                  : 'No node answered the survey, so this is unknown rather ' +
                    'than zero.'
              }
            >
              <Typography variant="body2">
                {profile.connections != null ? profile.connections : '—'}
                {profile.serve_as_default &&
                  ', plus connections with no profile (see Overview)'}
              </Typography>
            </Tooltip>
          </InlineStat>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1.5 }}
        >
          Created {fmtDateTime(profile.created_at)} · updated{' '}
          {fmtDateTime(profile.updated_at)}
        </Typography>
      </Panel>

      <Panel
        title="Versions"
        subtitle="Established connections keep the dictionary they were given until they reconnect — activating or deactivating a version here does not recall anything already delivered."
        action={
          // Rolling back needs a version that served before and does not now.
          profile.versions.some(v => !v.active && v.activated_at) && (
            <ConfirmButton
              title="Rollback to the previous version?"
              body="Re-activates whichever version was active before the current one. Established connections keep whatever dictionary they currently have until they reconnect."
              confirmText="Rollback"
              confirmColor="warning"
              onConfirm={() => handleRollback()}
            >
              {open => (
                <Button
                  variant="tonal"
                  color="inherit"
                  size="small"
                  startIcon={<UndoIcon />}
                  onClick={open}
                  disabled={rollbackBusy}
                >
                  Rollback
                </Button>
              )}
            </ConfirmButton>
          )
        }
      >
        {profile.versions.length === 0 ? (
          <EmptyState
            title="No versions yet"
            hint="Each dictionary created from a training session becomes a version here."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Contents</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell align="right">Measured ratio</TableCell>
                  <TableCell>Approved by / at</TableCell>
                  <TableCell align="right">Rollout</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                  <TableCell padding="checkbox"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profile.versions.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {fmtTrainingMode(
                        v.fidelity === 'reviewed' ? 'values' : 'schema'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip
                        title={`What each new connection downloads. ${HumanSize(v.artifact_json_size)} once unpacked.`}
                      >
                        <span>{HumanSize(v.artifact_json_wire_size)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <ExpectedRatio
                        ratio={v.approved_ratio}
                        measured={v.ratio_measured}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {v.approved_by || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDateTime(v.approved_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{v.rollout_percent}%</TableCell>
                    <TableCell>
                      <CapabilityChip
                        label={v.active ? 'Active' : 'Inactive'}
                        tone={v.active ? 'on' : 'off'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {v.active ? (
                        <ConfirmButton
                          title="Deactivate this version?"
                          body="Established connections keep this dictionary until they reconnect — deactivating doesn't recall anything already delivered."
                          confirmText="Deactivate"
                          confirmColor="warning"
                          onConfirm={() => handleDeactivate(v.id)}
                        >
                          {open => (
                            <Button
                              variant="tonal"
                              color="inherit"
                              size="small"
                              onClick={open}
                              disabled={busyVersionId === v.id}
                              sx={versionActionSx}
                            >
                              Deactivate
                            </Button>
                          )}
                        </ConfirmButton>
                      ) : (
                        <Button
                          variant="tonal"
                          color="primary"
                          size="small"
                          onClick={() => setActivateTarget(v)}
                          sx={versionActionSx}
                        >
                          Activate
                        </Button>
                      )}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        aria-label={`More for version ${v.id}`}
                        onClick={e =>
                          setVersionMenu({
                            anchor: e.currentTarget,
                            version: v,
                          })
                        }
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />
      <Menu
        anchorEl={versionMenu?.anchor}
        open={versionMenu !== null}
        onClose={() => setVersionMenu(null)}
      >
        {versionMenu &&
          canReadValues &&
          versionMenu.version.fidelity === 'reviewed' &&
          versionMenu.version.values_count > 0 && (
            <MenuItem
              onClick={() => {
                setValuesTarget(versionMenu.version)
                setVersionMenu(null)
              }}
            >
              Values ({versionMenu.version.values_count})…
            </MenuItem>
          )}
        <MenuItem
          onClick={() => {
            if (versionMenu) copyId(versionMenu.version.artifact_json_id)
            setVersionMenu(null)
          }}
        >
          Copy JSON dictionary id
        </MenuItem>
        {versionMenu?.version.artifact_protobuf_id && (
          <MenuItem
            onClick={() => {
              copyId(versionMenu.version.artifact_protobuf_id)
              setVersionMenu(null)
            }}
          >
            Copy Protobuf dictionary id
          </MenuItem>
        )}
      </Menu>
      <ActivateVersionDialog
        version={activateTarget}
        onClose={() => setActivateTarget(null)}
        onActivate={(id, percent) => handleActivate(id, percent)}
      />
      <AudienceConfirmDialog
        open={audiencePending !== null}
        profile={profile}
        onClose={() => setAudiencePending(null)}
        onConfirm={async () => {
          if (audiencePending?.kind === 'activate') {
            await handleActivate(
              audiencePending.versionId,
              audiencePending.rolloutPercent,
              true
            )
          } else if (audiencePending?.kind === 'rollback') {
            await handleRollback(true)
          }
        }}
      />
      <VersionValuesDialog
        api={api}
        version={valuesTarget}
        canWithdraw={canChange}
        onClose={() => setValuesTarget(null)}
        onWithdrawn={created => {
          setValuesTarget(null)
          showAlert(
            created.active
              ? `Withdrawn. The rebuilt version now serves ${created.rollout_percent}% of matching connections.`
              : 'Withdrawn. The rebuilt version is in the list, inactive.',
            { severity: 'success' }
          )
          load()
        }}
      />
    </Box>
  )
}
