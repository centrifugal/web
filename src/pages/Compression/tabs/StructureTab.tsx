import { useCallback, useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

import { ShellContext } from 'contexts/ShellContext'
import { Panel, FieldRow, CapabilityChip } from 'pages/Inspector/ui'
import { CopyButton } from 'components/CopyButton'
import { HumanSize } from 'utils/Functions'

import { useCompressionApi, StructureInfo } from '../api'

interface StructureTabProps {
  authorization: string
  signinSilent: () => void
}

// StructureTab: the dictionary trained on the protocol rather than on traffic.
// It is a compile-time constant in the protocol package - not a row in the
// database - so it is available on a deployment that has collected nothing, and
// its content-addressed id is identical on every node and across restarts,
// which lets a client cache it once and never fetch it again.
//
// Carrying no application data is what makes it free to turn on: no training
// session, no review, nothing of the operator's in it. It is the floor every
// other tier falls back to.
export const StructureTab = ({
  authorization,
  signinSilent,
}: StructureTabProps) => {
  const api = useCompressionApi({ authorization, signinSilent })
  const { showAlert } = useContext(ShellContext)

  const [structure, setStructure] = useState<StructureInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.getStructure()
      setStructure(data)
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const handleToggle = async (_: unknown, checked: boolean) => {
    if (!structure) return
    setToggling(true)
    const previous = structure
    // Optimistic flip — POST /structure returns the authoritative record, which
    // we adopt below; on failure we roll back to what we had before.
    setStructure({ ...structure, active: checked })
    try {
      const updated = await api.setStructureActive(checked)
      setStructure(updated)
      showAlert(
        checked
          ? 'Structure dictionary activated'
          : 'Structure dictionary deactivated',
        { severity: 'success' }
      )
    } catch (err) {
      setStructure(previous)
      api.handleError(err)
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress disableShrink />
      </Box>
    )
  }

  if (!structure) {
    return (
      <Alert severity="error">
        Failed to load the structure dictionary. Try reloading the page.
      </Alert>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Panel
        title="Structure dictionary"
        subtitle="Trained on the Centrifugo protocol itself — the field names and framing every message shares — and shipped with the server, so it is ready before you have collected anything. It holds no application data, which is why there is nothing to review. Every connection that has no profile dictionary of its own falls back to it: unclassified connections, profiles not yet trained, and connections a staged rollout has not reached."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FieldRow label="Status">
            <CapabilityChip
              label={
                !structure.active
                  ? 'Inactive'
                  : structure.serving_enabled
                    ? 'Active'
                    : 'On, not serving'
              }
              tone={
                !structure.active
                  ? 'off'
                  : structure.serving_enabled
                    ? 'on'
                    : 'warn'
              }
              title={
                structure.active && !structure.serving_enabled
                  ? 'Switched on here, but Serve dictionaries is off on the ' +
                    'Overview tab, so no connection is receiving it.'
                  : undefined
              }
            />
          </FieldRow>
          <FieldRow label="Protocol">
            <Typography variant="body2">{structure.protocol}</Typography>
          </FieldRow>
          <FieldRow label="Artifact id">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {structure.artifact_id}
              </Typography>
              <CopyButton
                value={structure.artifact_id}
                label="Copy artifact id"
              />
            </Box>
          </FieldRow>
          <FieldRow label="Raw size">
            <Typography variant="body2">
              {HumanSize(structure.size_bytes)}
            </Typography>
          </FieldRow>
          <FieldRow label="Wire size">
            <Typography variant="body2">
              {HumanSize(structure.wire_size)}
            </Typography>
          </FieldRow>
        </Box>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={structure.active}
                disabled={toggling}
                onChange={handleToggle}
              />
            }
            label="Serve the structure dictionary"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5 }}
          >
            Applies to every server within a second or two — up to 20 seconds if
            one misses the signal. Connections that are already open keep the
            dictionary they have until they reconnect, so switching this off
            stops new connections getting one but takes nothing back from
            anyone. Nothing is served at all unless "Serve dictionaries" is on.
          </Typography>
        </Box>
      </Panel>

      <Alert severity="info" variant="outlined">
        {structure.note ||
          'JSON only: on Protobuf the structure dictionary measured no better than no dictionary at all, so it is never served there — shipping it would cost a transfer for nothing.'}
      </Alert>
    </Box>
  )
}

export default StructureTab
