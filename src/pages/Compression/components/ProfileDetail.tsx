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

import { ShellContext } from 'contexts/ShellContext'
import { Panel, CapabilityChip, InlineStat } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'
import { ConfirmButton } from 'components/ConfirmButton'
import { CopyButton } from 'components/CopyButton'
import { HumanSize } from 'utils/Functions'

import {
  CompressionApiHook,
  CompressionApiError,
  ProfileDetail as ProfileDetailData,
  ProfilePatch,
  Version,
} from '../api'
import { fmtDateTime, fmtRatio } from '../format'
import { EditProfileDialog } from './EditProfileDialog'
import { ActivateVersionDialog } from './ActivateVersionDialog'

interface ProfileDetailProps {
  api: CompressionApiHook
  profileId: string
  onBack: () => void
  onDeleted: () => void
}

const fmtApprovedRatio = (r: Version['approved_ratio']): string => {
  const parts: string[] = []
  if (r?.json != null) parts.push(`json ${fmtRatio(r.json)}`)
  if (r?.protobuf != null) parts.push(`protobuf ${fmtRatio(r.protobuf)}`)
  return parts.length ? parts.join(' · ') : '—'
}

// ProfileDetail: a single profile's full record — its audience flags and its
// version history. Kept as an in-tab panel switch (not a route) so it shares
// the Profiles tab's URL and doesn't need its own navigation entry.
export const ProfileDetail = ({
  api,
  profileId,
  onBack,
  onDeleted,
}: ProfileDetailProps) => {
  const { showAlert } = useContext(ShellContext)
  const [profile, setProfile] = useState<ProfileDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [activateTarget, setActivateTarget] = useState<Version | null>(null)
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)

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

  const handleActivate = async (versionId: string, rolloutPercent: number) => {
    try {
      await api.activateVersion(versionId, rolloutPercent)
      showAlert('Version activated', { severity: 'success' })
      setActivateTarget(null)
      load()
    } catch (err) {
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

  const handleRollback = async () => {
    if (!profile) return
    setRollbackBusy(true)
    try {
      await api.rollbackProfile(profile.id)
      showAlert('Rolled back to the previous version', { severity: 'success' })
      load()
    } catch (err) {
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

      <Panel title="Profile" subtitle={profile.notes || undefined}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 3,
            rowGap: 1,
          }}
        >
          <InlineStat label="Client declarable">
            <CapabilityChip
              label={profile.client_declarable ? 'Yes' : 'No'}
              tone={profile.client_declarable ? 'on' : 'off'}
              title="Whether a client may request this profile by name in its subscription."
            />
          </InlineStat>
          <InlineStat label="Serve as default">
            <CapabilityChip
              label={profile.serve_as_default ? 'Yes' : 'No'}
              tone={profile.serve_as_default ? 'on' : 'off'}
              title="Whether unmatched connections receive this profile automatically."
            />
          </InlineStat>
          <InlineStat label="Training mode">
            <Typography variant="body2">{profile.training_mode}</Typography>
          </InlineStat>
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
              </Typography>
            </Tooltip>
          </InlineStat>
          <InlineStat label="Revision">
            <Typography variant="body2">{profile.revision}</Typography>
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
          <ConfirmButton
            title="Rollback to the previous version?"
            body="Re-activates whichever version was active before the current one. Established connections keep whatever dictionary they currently have until they reconnect."
            confirmText="Rollback"
            confirmColor="warning"
            onConfirm={handleRollback}
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
        }
      >
        {profile.versions.length === 0 ? (
          <EmptyState
            title="No versions yet"
            hint="Versions are created by assigning a schema candidate or approving a reviewed one from a training session."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fidelity</TableCell>
                  <TableCell>Artifacts</TableCell>
                  <TableCell align="right">Raw / wire size</TableCell>
                  <TableCell align="right">Approved ratio</TableCell>
                  <TableCell>Approved by / at</TableCell>
                  <TableCell align="right">Rollout</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profile.versions.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>{v.fidelity}</TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.25,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            json: {v.artifact_json_id.slice(0, 12)}…
                          </Typography>
                          <CopyButton
                            value={v.artifact_json_id}
                            label="Copy JSON artifact id"
                          />
                        </Box>
                        {v.artifact_protobuf_id && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              pb: {v.artifact_protobuf_id.slice(0, 12)}…
                            </Typography>
                            <CopyButton
                              value={v.artifact_protobuf_id}
                              label="Copy Protobuf artifact id"
                            />
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {HumanSize(v.artifact_json_size)} /{' '}
                      {HumanSize(v.artifact_json_wire_size)}
                    </TableCell>
                    <TableCell align="right">
                      {fmtApprovedRatio(v.approved_ratio)}
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
                        >
                          Activate
                        </Button>
                      )}
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
      <ActivateVersionDialog
        version={activateTarget}
        onClose={() => setActivateTarget(null)}
        onActivate={handleActivate}
      />
    </Box>
  )
}
