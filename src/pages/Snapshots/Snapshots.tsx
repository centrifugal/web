import { useContext, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

import {
  SnapshotsList,
  SnapshotDetail,
  CreateSnapshotDialog,
} from './components'

interface SnapshotsProps {
  signinSilent: () => void
  authorization: string
}

interface Snapshot {
  snapshot_id: string
  kind: string
  status: string
  filter: any
  parent_snapshot_id?: string
  created_at: string
  updated_at: string
  finished_at?: string
  expires_at?: string
  rows_inserted: number
  nodes_expected: number
  nodes_reported: number
  error_message?: string
  requested_by: string
}

export const Snapshots = ({ signinSilent, authorization }: SnapshotsProps) => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const { rawRequest } = useAdminApi({ authorization, signinSilent })
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState<boolean>(true)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null)
  const [notEnabled, setNotEnabled] = useState<boolean>(false)
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false)
  const [createDialogParentId, setCreateDialogParentId] = useState<
    string | undefined
  >()
  const [createDialogPrefilled, setCreateDialogPrefilled] =
    useState<any>(undefined)
  const [nextCursor, setNextCursor] = useState<string>('')

  const fetchSnapshots = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ limit: '10' })
        if (cursor) {
          params.append('cursor', cursor)
        }

        const response = await rawRequest(
          `admin/api/snapshots?${params.toString()}`
        )

        if (response.status === 404) {
          setNotEnabled(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          if (response.status === 401) {
            signinSilent()
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        if (cursor) {
          setSnapshots(prev => [...prev, ...data.snapshots])
        } else {
          setSnapshots(data.snapshots || [])
        }
        setNextCursor(data.next_cursor || '')
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch snapshots:', error)
        showAlert('Failed to load snapshots', { severity: 'error' })
        setLoading(false)
      }
    },
    [rawRequest, signinSilent, showAlert]
  )

  const fetchSnapshotDetails = useCallback(
    async (snapshotId: string) => {
      try {
        const response = await rawRequest(`admin/api/snapshots/${snapshotId}`)

        if (response.status === 404) {
          showAlert('Snapshot not found', { severity: 'error' })
          navigate('/snapshots')
          return
        }

        if (!response.ok) {
          if (response.status === 401) {
            signinSilent()
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setCurrentSnapshot(data)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch snapshot details:', error)
        showAlert('Failed to load snapshot details', { severity: 'error' })
        setLoading(false)
      }
    },
    [rawRequest, signinSilent, showAlert, navigate]
  )

  useEffect(() => {
    if (id) {
      setTitle('Snapshot Details')
      setCurrentSnapshot(null) // Clear previous snapshot data
      setLoading(true) // Show loading state
      fetchSnapshotDetails(id)
    } else {
      setTitle('Snapshots')
      setCurrentSnapshot(null) // Clear snapshot data when going back to list
      fetchSnapshots()

      // Check if we need to open create dialog with prefilled data
      if (location.state?.openCreateDialog) {
        const prefilledData = location.state.prefilledData
        setCreateDialogOpen(true)
        setCreateDialogParentId(prefilledData?.parentSnapshotId)
        setCreateDialogPrefilled({
          type: prefilledData?.type,
          filterType: prefilledData?.filterType,
          value: prefilledData?.value,
        })

        // Clear the state to prevent reopening on subsequent renders
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
  }, [id, setTitle, location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateSnapshot = async (snapshotData: any) => {
    try {
      const response = await rawRequest(`admin/api/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snapshotData),
      })

      if (!response.ok) {
        if (response.status === 401) {
          signinSilent()
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      showAlert('Snapshot created successfully', { severity: 'success' })

      // Navigate to the new snapshot's detail page
      navigate(`/snapshots/${data.snapshot_id}`)

      setCreateDialogOpen(false)
      // Clear parent ID and prefilled data
      setCreateDialogParentId(undefined)
      setCreateDialogPrefilled(undefined)
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      showAlert('Failed to create snapshot', { severity: 'error' })
    }
  }

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false)
    // Clear parent ID and prefilled data when dialog is closed
    setCreateDialogParentId(undefined)
    setCreateDialogPrefilled(undefined)
  }

  const handleCreateConnectionsSnapshot = (
    channelName: string,
    parentSnapshotId: string
  ) => {
    setCreateDialogOpen(true)
    setCreateDialogParentId(parentSnapshotId)
    setCreateDialogPrefilled({
      type: 'connections',
      filterType: 'channel',
      value: channelName,
    })
  }

  const handleLoadMore = () => {
    if (nextCursor && !loading) {
      fetchSnapshots(nextCursor)
    }
  }

  const handleBackToList = () => {
    navigate('/snapshots')
    setCurrentSnapshot(null)
  }

  if (notEnabled) {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <Alert severity="info">
          Snapshots are not enabled. Please check your server configuration.
        </Alert>
      </Box>
    )
  }

  if (loading && !currentSnapshot && snapshots.length === 0) {
    return (
      <Box className="max-w-8xl mx-auto p-8 text-center">
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading snapshots...
        </Typography>
      </Box>
    )
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {id && currentSnapshot ? (
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {currentSnapshot.kind.charAt(0).toUpperCase() +
                  currentSnapshot.kind.slice(1)}{' '}
                Snapshot, ID
                <Typography
                  component="span"
                  variant="h6"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    fontWeight: 400,
                  }}
                >
                  {currentSnapshot.snapshot_id}
                </Typography>
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBackToList}
              >
                Back to List
              </Button>
            </Box>
            <SnapshotDetail
              snapshot={currentSnapshot}
              authorization={authorization}
              signinSilent={signinSilent}
              onCreateConnectionsSnapshot={handleCreateConnectionsSnapshot}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h5" component="h1">
                All Snapshots
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Snapshot
              </Button>
            </Box>
            <SnapshotsList
              snapshots={snapshots}
              loading={loading}
              nextCursor={nextCursor}
              onLoadMore={handleLoadMore}
            />
          </CardContent>
        </Card>
      )}

      <CreateSnapshotDialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        onSubmit={handleCreateSnapshot}
        parentSnapshotId={createDialogParentId}
        prefilledData={createDialogPrefilled}
      />
    </Box>
  )
}
