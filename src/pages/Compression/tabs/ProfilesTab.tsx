import { useCallback, useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'

import { EmptyState } from 'components/EmptyState'
import { Panel, CapabilityChip } from 'pages/Inspector/ui'

import { useUrlSelection } from '../useUrlSelection'
import { useCompressionApi, CreateProfileRequest, Profile } from '../api'
import { fmtRatio } from '../format'
import { CreateProfileDialog } from '../components/CreateProfileDialog'
import { ProfileDetail } from '../components/ProfileDetail'
import { UnclaimedPanel } from '../components/UnclaimedPanel'

interface ProfilesTabProps {
  authorization: string
  signinSilent: () => void
}

const fmtApprovedRatio = (r: Profile['active_version']): string => {
  if (!r) return '—'
  const parts: string[] = []
  if (r.approved_ratio?.json != null)
    parts.push(`json ${fmtRatio(r.approved_ratio.json)}`)
  if (r.approved_ratio?.protobuf != null)
    parts.push(`protobuf ${fmtRatio(r.approved_ratio.protobuf)}`)
  return parts.length ? parts.join(' · ') : '—'
}

// Profiles: manage dictionary audiences (create/edit profiles, review
// unclaimed client-declared names, drill into a profile's version history).
export const ProfilesTab = ({
  authorization,
  signinSilent,
}: ProfilesTabProps) => {
  const api = useCompressionApi({ authorization, signinSilent })

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useUrlSelection('profile')

  const load = useCallback(async () => {
    try {
      const data = await api.listProfiles()
      setProfiles(data.profiles || [])
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (req: CreateProfileRequest) => {
    try {
      const created = await api.createProfile(req)
      setCreateOpen(false)
      setProfiles(prev => [created, ...prev])
    } catch (err) {
      api.handleError(err)
    }
  }

  if (selectedId) {
    return (
      <ProfileDetail
        api={api}
        profileId={selectedId}
        onBack={() => {
          setSelectedId(null)
          load()
        }}
        onDeleted={() => {
          setSelectedId(null)
          load()
        }}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Panel
        title="Profiles"
        subtitle="Each profile is a dictionary audience — a name, an active version, and who may receive it."
        action={
          <Button
            variant="solid"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create profile
          </Button>
        }
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress disableShrink />
          </Box>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<PeopleAltIcon sx={{ fontSize: 40 }} />}
            title="No profiles yet"
            hint="Create a profile, then train and approve a dictionary for it from the Sessions tab."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Fidelity</TableCell>
                  <TableCell align="right">Approved ratio</TableCell>
                  <TableCell align="right">Connections</TableCell>
                  <TableCell>Declarable</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profiles.map(p => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {p.name}
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {p.notes || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.active_version ? (
                        <Tooltip title="Fidelity of the currently active version">
                          <span>{p.active_version.fidelity}</span>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          no active version
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {fmtApprovedRatio(p.active_version)}
                    </TableCell>
                    <TableCell align="right">
                      {p.connections != null ? p.connections : '—'}
                    </TableCell>
                    <TableCell>
                      <CapabilityChip
                        label={p.client_declarable ? 'Yes' : 'No'}
                        tone={p.client_declarable ? 'on' : 'off'}
                      />
                    </TableCell>
                    <TableCell>
                      <CapabilityChip
                        label={p.serve_as_default ? 'Yes' : 'No'}
                        tone={p.serve_as_default ? 'on' : 'off'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="tonal"
                        color="inherit"
                        size="small"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedId(p.id)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <UnclaimedPanel api={api} />

      <CreateProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </Box>
  )
}

export default ProfilesTab
