import { useCallback, useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTheme } from '@mui/material/styles'

import { ShellContext } from 'contexts/ShellContext'
import { EmptyState } from 'components/EmptyState'
import { Panel, CapabilityChip, ChipTone, InlineStat } from 'pages/Inspector/ui'
import { HumanSize } from 'utils/Functions'

import {
  useCompressionApi,
  CompressionOverview,
  ConnectionsByTier,
} from '../api'

const POLL_MS = 5000

interface OverviewTabProps {
  authorization: string
  signinSilent: () => void
}

const fmtInt = (n: number) => Number(n ?? 0).toLocaleString()
const fmtRatio = (n: number) => `${(n ?? 0).toFixed(2)}x`
// HumanSize already keeps the sign through the division, so only a leading
// "+" needs adding for the positive case.
const fmtSigned = (n: number) => (n > 0 ? '+' : '') + HumanSize(n)

interface Tier {
  key: keyof ConnectionsByTier
  label: string
  hint: string
}

// Fixed order, least to most specific — matches the tiers a connection can
// fall into server-side, from nothing to its own trained profile.
const TIERS: Tier[] = [
  {
    key: 'none',
    label: 'No dictionary',
    hint: 'Compressing with no preset dictionary at all.',
  },
  {
    key: 'structure',
    label: 'Structure only',
    hint: 'Trained on the protocol, not on your traffic, and shipped with the server. No application data in it.',
  },
  {
    key: 'default_profile',
    label: 'Default profile',
    hint: 'A profile served by default (serve_as_default), not requested by the client.',
  },
  {
    key: 'own_profile',
    label: 'Own profile',
    hint: 'The dictionary trained and approved for this connection.',
  },
]

// tierLabel reuses the tier descriptions above so the delivery table names a
// tier the same way the breakdown above it does.
const tierLabel = (tier: string): string =>
  TIERS.find(t => t.key === tier)?.label ?? tier ?? '—'

// OverviewTab: the operator's "is this working" view — the deployment switch,
// the live tier breakdown, and the per-profile net savings that is the single
// most important number this page can show.
export const OverviewTab = ({
  authorization,
  signinSilent,
}: OverviewTabProps) => {
  const theme = useTheme()
  const api = useCompressionApi({ authorization, signinSilent })
  const { showAlert } = useContext(ShellContext)

  const tierColor = (key: keyof ConnectionsByTier): string => {
    switch (key) {
      case 'none':
        return theme.palette.text.disabled
      case 'structure':
        return '#22c3aa'
      case 'default_profile':
        return '#f2a93b'
      case 'own_profile':
        return theme.palette.primary.main
      default:
        return theme.palette.text.disabled
    }
  }

  const [overview, setOverview] = useState<CompressionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  // Same visibility gate as the Status page: no point polling a backgrounded tab.
  const [visible, setVisible] = useState(document.visibilityState === 'visible')
  useEffect(() => {
    const onVisibilityChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await api.getCompression()
      setOverview(data)
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (visible) load()
    const id = setInterval(() => visible && load(), POLL_MS)
    return () => clearInterval(id)
  }, [load, visible])

  const handleToggleEnabled = async (
    _: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    if (!overview) return
    setToggling(true)
    const previous = overview
    setOverview({ ...overview, enabled: checked })
    try {
      const updated = await api.setCompressionEnabled(checked)
      setOverview(updated)
      showAlert(
        checked
          ? 'Dictionary compression enabled'
          : 'Dictionary compression disabled',
        { severity: 'success' }
      )
    } catch (err) {
      setOverview(previous)
      api.handleError(err)
    } finally {
      setToggling(false)
    }
  }

  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress disableShrink />
      </Box>
    )
  }

  if (!overview) {
    return (
      <Alert severity="error">
        Failed to load compression status. Try reloading the page.
      </Alert>
    )
  }

  // The two switches are independent settings but not independent effects:
  // with serving off, Select returns nothing before it reaches the structure
  // fallback. Reporting this tier as "Active" then describes a stored flag,
  // not what any connection is getting.
  const structureLabel = !overview.structure_active
    ? 'Inactive'
    : overview.enabled
      ? 'Active'
      : 'On, not serving'
  const structureTone: ChipTone = !overview.structure_active
    ? 'off'
    : overview.enabled
      ? 'on'
      : 'warn'

  const serving = overview.serving
  // A node that does not answer contributes nothing, which looks exactly like
  // a node with no connections. Only the node count can tell them apart.
  const partialSurvey =
    !!serving &&
    serving.nodes_expected > 0 &&
    serving.nodes_reporting < serving.nodes_expected
  const tierTotal = serving
    ? TIERS.reduce(
        (sum, t) => sum + (serving.connections_by_tier[t.key] || 0),
        0
      )
    : 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Panel
        title="Deployment"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={overview.enabled}
                  disabled={toggling}
                  onChange={handleToggleEnabled}
                />
              }
              label={
                <Typography variant="body2">Serve dictionaries</Typography>
              }
              sx={{ mr: 0 }}
            />
            <Tooltip
              title={
                'Applies to every server within a second or two - up to 20 ' +
                'seconds if one misses the signal. Connections that are ' +
                'already open keep the dictionary they have until they ' +
                'reconnect, so switching this off stops new connections ' +
                'getting one but takes nothing back from anyone. Training ' +
                'sessions carry on collecting either way.'
              }
            >
              <InfoOutlinedIcon
                fontSize="small"
                sx={{ color: 'text.disabled' }}
              />
            </Tooltip>
          </Box>
        }
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 3,
            rowGap: 1,
          }}
        >
          {!overview.enabled && (
            <CapabilityChip
              label="Nothing is being served"
              tone="warn"
              title={
                'Serve dictionaries is off, so no connection receives any ' +
                'dictionary - including the structure tier - whatever the ' +
                'settings beside this say.'
              }
            />
          )}
          <InlineStat label="Structure dictionary">
            <CapabilityChip label={structureLabel} tone={structureTone} />
          </InlineStat>
          <InlineStat label="Profiles">
            <Typography variant="body2">{fmtInt(overview.profiles)}</Typography>
          </InlineStat>
          <InlineStat label="Active versions">
            <Typography variant="body2">
              {fmtInt(overview.active_versions)}
            </Typography>
          </InlineStat>
        </Box>
      </Panel>

      <Panel
        title="Connections by tier"
        subtitle="What every currently-connected client is compressing against, right now."
      >
        {!serving ? (
          <EmptyState
            title="No live data yet"
            hint="No node has answered the survey yet. This refreshes automatically."
          />
        ) : tierTotal === 0 ? (
          <EmptyState title="No connections reporting" />
        ) : (
          <Box>
            <Box
              sx={{
                display: 'flex',
                gap: '2px',
                height: 28,
                borderRadius: 1.5,
                overflow: 'hidden',
              }}
            >
              {TIERS.map(t => {
                const value = serving.connections_by_tier[t.key] || 0
                if (value <= 0) return null
                const pct = (value / tierTotal) * 100
                return (
                  <Tooltip
                    key={t.key}
                    title={`${t.label}: ${fmtInt(value)} (${pct.toFixed(1)}%)`}
                    arrow
                  >
                    <Box
                      sx={{
                        flexGrow: value,
                        flexBasis: 0,
                        minWidth: 2,
                        bgcolor: tierColor(t.key),
                      }}
                    />
                  </Tooltip>
                )
              })}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 1.5 }}>
              {TIERS.map(t => {
                const value = serving.connections_by_tier[t.key] || 0
                const pct = tierTotal > 0 ? (value / tierTotal) * 100 : 0
                return (
                  <Tooltip key={t.key} title={t.hint} arrow>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: tierColor(t.key),
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {t.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {fmtInt(value)}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        ({pct.toFixed(1)}%)
                      </Typography>
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>

            <Typography
              variant="caption"
              color={partialSurvey ? 'warning.main' : 'text.secondary'}
              sx={{ display: 'block', mt: 1.5 }}
            >
              {serving.nodes_expected > 0
                ? `${serving.nodes_reporting} of ${serving.nodes_expected} nodes reporting.`
                : `${serving.nodes_reporting} node${serving.nodes_reporting === 1 ? '' : 's'} reporting.`}
              {partialSurvey &&
                ' These counts are summed over the nodes that answered, so' +
                  ' they are an undercount until every node does.'}
            </Typography>
          </Box>
        )}
      </Panel>

      <Panel
        title="Per-profile delivery"
        subtitle="Measured from real traffic, not a training-time estimate. Totals count from each server's last restart and are held in memory, so restarting one resets its share of every figure here."
      >
        {!serving || (serving.by_profile?.length ?? 0) === 0 ? (
          <EmptyState
            title="No profile traffic reporting yet"
            hint="A profile appears here once a connection using it has exchanged traffic."
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Profile</TableCell>
                    <TableCell>Protocol</TableCell>
                    <TableCell>Serving</TableCell>
                    <TableCell align="right">Realized ratio</TableCell>
                    <TableCell align="right">Cold / warm connects</TableCell>
                    <TableCell align="right">Net bytes saved</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(serving.by_profile ?? []).map((p, i, rows) => {
                    // A second row for the same profile and protocol is a
                    // different dictionary: the structure tier for connections
                    // outside a rollout, or a version being retired that some
                    // connections still hold. Naming it is the whole point of
                    // splitting the rows - one blended ratio was comparable
                    // with neither the client's number nor the version's.
                    const split = rows.some(
                      o =>
                        o !== p &&
                        o.profile === p.profile &&
                        o.protocol === p.protocol
                    )
                    const totalConnects = p.cold_connects + p.warm_connects
                    const warmPct =
                      totalConnects > 0
                        ? (p.warm_connects / totalConnects) * 100
                        : 0
                    const negative = p.net_saved_bytes < 0
                    return (
                      <TableRow
                        key={`${p.profile}:${p.protocol}:${p.tier}:${p.dictionary_id}`}
                      >
                        <TableCell>
                          {p.profile !== '' ? (
                            p.profile
                          ) : (
                            // Rows are grouped by the profile a connection was
                            // classified into, not by the tier it was served -
                            // so an empty name is "no profile", which is not
                            // the same as "structure tier". With a default
                            // profile nominated these connections receive that
                            // profile's dictionary and still appear here.
                            <Tooltip title="Connections with no profile. They receive the structure dictionary, or the default profile's if one is nominated.">
                              <Typography
                                variant="body2"
                                component="span"
                                color="text.secondary"
                                sx={{ fontStyle: 'italic' }}
                              >
                                unclassified
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>{p.protocol}</TableCell>
                        <TableCell>
                          <Typography variant="body2" component="span">
                            {tierLabel(p.tier)}
                          </Typography>
                          {p.dictionary_id !== '' && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                fontFamily: 'monospace',
                              }}
                              title={
                                split
                                  ? 'This profile is serving more than one dictionary right now. Each row counts only the frames compressed against its own, so the ratios are comparable with what a client reports and with the ratio that version was approved at.'
                                  : 'The dictionary these frames were compressed against.'
                              }
                            >
                              {p.dictionary_id}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {fmtRatio(p.realized_ratio)}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip
                            title="Warm connections presented an id for a dictionary they already held and paid no transfer for it; cold connections paid the download."
                            arrow
                          >
                            <span>
                              {fmtInt(p.cold_connects)} cold ·{' '}
                              {fmtInt(p.warm_connects)} warm (
                              {warmPct.toFixed(0)}% warm)
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 0.5,
                            }}
                          >
                            {negative && (
                              <Tooltip
                                title="This profile is costing more than it saves: dictionary re-delivery is outweighing the compression gain."
                                arrow
                              >
                                <WarningAmberIcon
                                  sx={{ fontSize: 16, color: 'error.main' }}
                                />
                              </Tooltip>
                            )}
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color: negative ? 'error.main' : 'success.main',
                              }}
                            >
                              {fmtSigned(p.net_saved_bytes)}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5 }}
            >
              Net bytes saved is bytes in minus bytes out minus the bytes spent
              delivering the dictionary itself — never gross savings. A
              dictionary re-delivered on every reconnect can cost more than it
              saves; a negative value here means exactly that is happening, and
              the cold/warm split above is usually why.
            </Typography>
          </>
        )}
      </Panel>
    </Box>
  )
}

export default OverviewTab
