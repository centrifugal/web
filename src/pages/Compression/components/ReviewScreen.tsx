import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import Menu from '@mui/material/Menu'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import BlockIcon from '@mui/icons-material/Block'
import UndoIcon from '@mui/icons-material/Undo'

import { ShellContext } from 'contexts/ShellContext'
import { HumanSize } from 'utils/Functions'
import { Panel, FieldRow } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'

import {
  CompressionApiHook,
  Candidate,
  CandidatePreview,
  CandidateValue,
  DeniedSummary,
  GetCandidateValuesParams,
} from '../api'
import { fmtInt, fmtRatio, fmtRelative } from '../format'
import { ApproveCandidateDialog } from './ApproveCandidateDialog'
import { CreatedVersion } from './ActivateNowField'

const PAGE_SIZE = 50

interface ReviewScreenProps {
  api: CompressionApiHook
  candidate: Candidate
  onBack: () => void
  onCandidateUpdated: (c: Candidate) => void
  // The profile the session was trained for, preselected on approve.
  defaultProfileId?: string
  onApproved: (created: CreatedVersion) => void
}

const DENIED_LABELS: {
  key: keyof DeniedSummary
  label: string
  hint: string
}[] = [
  {
    key: 'name',
    label: 'Name',
    hint: 'Looked like a person or account name/identifier.',
  },
  {
    key: 'shape',
    label: 'Shape',
    hint: "Denied by the value's structural shape, not its content.",
  },
  {
    key: 'channel_name',
    label: 'Channel name',
    hint: 'Matched a channel name — channel names can themselves be identifying.',
  },
  {
    key: 'length',
    label: 'Length',
    hint: 'Outside the length bounds a dictionary entry is allowed to have.',
  },
  {
    key: 'prior_decision',
    label: 'Denied before',
    hint: 'You denied these, or their field, for this profile before. They are still listed, marked "denied before" - undo the denial to allow one after all.',
  },
]

// ReviewScreen: the value-by-value approval gate between a training session
// and a served dictionary. Each value is allowed (ticked), denied, or not
// reviewed. Only allowed values ship, and only allowed and denied ones are
// remembered for the profile: a value nobody looked at is neither approved by
// being left alone nor refused forever, it is simply asked about next time.
//
// It opens on the saved draft, or else on the build's recommendation plus what
// earlier reviews of the profile allowed, with what they denied marked denied -
// so a retrain on a new session only asks about what is new.
export const ReviewScreen = ({
  api,
  candidate,
  onBack,
  onCandidateUpdated,
  defaultProfileId,
  onApproved,
}: ReviewScreenProps) => {
  const { showAlert } = useContext(ShellContext)

  const [values, setValues] = useState<CandidateValue[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [deniedSummary, setDeniedSummary] = useState<DeniedSummary | null>(null)
  const [totalContribution, setTotalContribution] = useState(0)
  // Contribution per value hash, accumulated as pages load, so coverage can be
  // reported for a selection spanning pages the operator has scrolled past.
  const contributionRef = useRef<Map<string, number>>(new Map())
  // Key path per value hash, as pages load, so denying a field can untick the
  // values of it already ticked.
  const pathRef = useRef<Map<string, string>>(new Map())

  const [searchDraft, setSearchDraft] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [minWitnessDraft, setMinWitnessDraft] = useState('')
  const [minWitnessApplied, setMinWitnessApplied] = useState('')

  const [nextCursor, setNextCursor] = useState('')
  // The cursor of every page visited to get here, the current one last. Going
  // back is popping this, so page N-1 is always cursors[length - 2].
  //
  // This used to be a stack of previous cursors plus a ref holding the current
  // one, and the ref was read inside setPrevCursors' updater - which React runs
  // later, after the ref had already been reassigned. Every Next pushed the
  // page it had just landed on, so Previous re-fetched the page you were
  // already looking at and nothing appeared to happen. One array has no
  // ordering to get wrong.
  const [cursors, setCursors] = useState<string[]>([''])

  // The review, accumulated across pages and searches for the lifetime of this
  // screen: allowed value hashes, denied value hashes, fields denied whole.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [denied, setDenied] = useState<Set<string>>(new Set())
  const [deniedFields, setDeniedFields] = useState<Set<string>>(new Set())
  const priorAllowed = candidate.prior_decisions?.allowed ?? []
  // Seeded once per candidate, from hashes rather than from the rows on
  // screen: the list is paged, so seeding from the loaded page would leave
  // the rest of a recommendation looking unticked on page two. A saved draft
  // wins - an operator's own answers must not be replaced by a machine's.
  const seededRef = useRef<string | null>(null)
  useEffect(() => {
    if (seededRef.current === candidate.id) return
    seededRef.current = candidate.id
    const draft = candidate.draft
    if (candidate.draft_count > 0 && draft) {
      setSelected(new Set(draft.approved ?? []))
      setDenied(new Set(draft.denied ?? []))
      setDeniedFields(new Set(draft.denied_fields ?? []))
      return
    }
    const prior = candidate.prior_decisions ?? {}
    setSelected(
      new Set([
        ...(candidate.recommended_hashes ?? []),
        ...(prior.allowed ?? []),
      ])
    )
    setDenied(new Set(prior.denied ?? []))
    setDeniedFields(new Set(prior.denied_fields ?? []))
  }, [candidate])
  const isDenied = (v: CandidateValue) =>
    denied.has(v.value_hash) || deniedFields.has(v.path)
  // Without a control window nothing could be measured, which the text below
  // has to say rather than claim a measured selection.
  const measured = candidate.size_curve.some(p => p.measured)

  // The size of the dictionary being reviewed FOR. It belongs here rather than
  // in the approve dialog: which values are worth approving depends on how much
  // room there is for them, so asking for the size after the review made the
  // review answer a question nobody had asked yet. Changing it re-selects what
  // was measured at the new size, and the approve step just carries it.
  const [targetSize, setTargetSize] = useState(0)
  useEffect(() => {
    const largest = candidate.size_curve.reduce(
      (max, p) => Math.max(max, p.size_bytes),
      0
    )
    setTargetSize(
      candidate.recommended_size > 0
        ? candidate.recommended_size
        : largest || 4096
    )
  }, [candidate.id, candidate.recommended_size, candidate.size_curve])

  // What the current ticks produce at the current size, measured against the
  // held-out control window. Ticking is not a free-form act - the artifact has
  // a ceiling, and past it extra values are dropped from the dictionary while
  // still being disclosed - so the consequence belongs next to the act rather
  // than in a dialog three clicks later.
  const [preview, setPreview] = useState<CandidatePreview | null>(null)
  const [previewStale, setPreviewStale] = useState(false)

  const ranked = candidate.ranked_hashes || []
  const handleTargetSize = (size: number) => {
    setTargetSize(size)
    const rung = candidate.size_curve.find(p => p.size_bytes === size)
    const n = rung?.recommended_values ?? 0
    // Only when the ranking actually covers that rung - otherwise leave the
    // ticks alone rather than applying a selection nobody measured. What an
    // earlier review allowed stays allowed: that was a person's answer, not
    // the build's.
    if (n > 0 && n <= ranked.length) {
      setSelected(new Set([...ranked.slice(0, n), ...priorAllowed]))
    }
  }

  const [savingDraft, setSavingDraft] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)

  const fetchValues = useCallback(
    async (opts: {
      cursor?: string
      direction: 'first' | 'next' | 'prev'
      search: string
      minWitness: string
    }) => {
      setLoading(true)
      try {
        const params: GetCandidateValuesParams = { limit: PAGE_SIZE }
        if (opts.cursor) params.cursor = opts.cursor
        if (opts.search) params.search = opts.search
        if (opts.minWitness) params.min_witness = Number(opts.minWitness)
        const data = await api.getCandidateValues(candidate.id, params)
        const rows = data.values || []
        setValues(rows)
        setTotal(data.total)
        setTotalContribution(data.total_contribution ?? 0)
        setDeniedSummary(data.denied_summary)
        rows.forEach(v =>
          contributionRef.current.set(v.value_hash, v.contribution)
        )
        setNextCursor(data.next_cursor || '')
        rows.forEach(v => pathRef.current.set(v.value_hash, v.path))
        if (opts.direction === 'next') {
          setCursors(prev => [...prev, opts.cursor || ''])
        } else if (opts.direction === 'prev') {
          setCursors(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
        } else {
          setCursors([''])
        }
      } catch (err) {
        api.handleError(err)
      } finally {
        setLoading(false)
      }
    },
    [api, candidate.id]
  )

  useEffect(() => {
    fetchValues({ direction: 'first', search: '', minWitness: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  const handleApplyFilters = () => {
    setSearchApplied(searchDraft)
    setMinWitnessApplied(minWitnessDraft)
    fetchValues({
      direction: 'first',
      search: searchDraft,
      minWitness: minWitnessDraft,
    })
  }

  const handleClearFilters = () => {
    setSearchDraft('')
    setMinWitnessDraft('')
    setSearchApplied('')
    setMinWitnessApplied('')
    fetchValues({ direction: 'first', search: '', minWitness: '' })
  }

  const handleNext = () => {
    if (!nextCursor || loading) return
    fetchValues({
      cursor: nextCursor,
      direction: 'next',
      search: searchApplied,
      minWitness: minWitnessApplied,
    })
  }
  const handlePrev = () => {
    if (cursors.length < 2 || loading) return
    fetchValues({
      cursor: cursors[cursors.length - 2],
      direction: 'prev',
      search: searchApplied,
      minWitness: minWitnessApplied,
    })
  }

  useEffect(() => {
    if (targetSize <= 0) return
    setPreviewStale(true)
    const hashes = Array.from(selected)
    let cancelled = false
    // Debounced: ticking a dozen boxes should measure once, not a dozen times.
    const timer = setTimeout(() => {
      api
        .previewCandidate(candidate.id, {
          approved: hashes,
          size_bytes: targetSize,
        })
        .then(p => {
          if (!cancelled) {
            setPreview(p)
            setPreviewStale(false)
          }
        })
        .catch(() => {
          if (!cancelled) setPreviewStale(false)
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, targetSize, candidate.id])

  const toggleValue = (hash: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(hash)
      else next.delete(hash)
      return next
    })
  }

  // Denying takes a value out of the allowed set; undoing a denial leaves it
  // not reviewed rather than allowed - allowing it is a tick of its own.
  const setValueDenied = (hash: string, on: boolean) => {
    setDenied(prev => {
      const next = new Set(prev)
      if (on) next.add(hash)
      else next.delete(hash)
      return next
    })
    if (on) toggleValue(hash, false)
  }
  const setFieldDenied = (path: string, on: boolean) => {
    setDeniedFields(prev => {
      const next = new Set(prev)
      if (on) next.add(path)
      else next.delete(path)
      return next
    })
    if (on) {
      setSelected(prev => {
        const next = new Set(prev)
        prev.forEach(h => {
          if (pathRef.current.get(h) === path) next.delete(h)
        })
        return next
      })
    }
  }
  const [denyMenu, setDenyMenu] = useState<{
    anchor: HTMLElement
    value: CandidateValue
  } | null>(null)

  const selectAllShown = () => {
    setSelected(prev => {
      const next = new Set(prev)
      values.forEach(v => {
        if (!isDenied(v)) next.add(v.value_hash)
      })
      return next
    })
  }
  const clearAllShown = () => {
    setSelected(prev => {
      const next = new Set(prev)
      values.forEach(v => next.delete(v.value_hash))
      return next
    })
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      const updated = await api.draftCandidate(candidate.id, {
        approved: Array.from(selected),
        denied: Array.from(denied),
        denied_fields: Array.from(deniedFields),
      })
      onCandidateUpdated(updated)
      showAlert(
        `Draft saved — ${selected.size.toLocaleString()} allowed, ${denied.size.toLocaleString()} denied so far. Review window extended to ${fmtRelative(updated.expires_at)}.`,
        { severity: 'success' }
      )
    } catch (err) {
      api.handleError(err)
    } finally {
      setSavingDraft(false)
    }
  }

  // What share of the achievable saving the current selection covers. Values
  // are listed best-first, so this climbs steeply and then flattens - which is
  // the signal to stop reading.
  const selectedContribution = Array.from(selected).reduce(
    (sum, h) => sum + (contributionRef.current.get(h) ?? 0),
    0
  )
  const coverage =
    totalContribution > 0 ? selectedContribution / totalContribution : 0

  // Selects down the visible page until the target share is covered. The
  // alternative is reading every row to find the handful that matter: on a
  // real candidate the top 30 of 945 carried two thirds of the benefit.
  const selectTopUpTo = (target: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      let running = selectedContribution
      for (const v of values) {
        if (running / Math.max(totalContribution, 1) >= target) break
        if (!next.has(v.value_hash) && !isDenied(v)) {
          next.add(v.value_hash)
          running += v.contribution
        }
      }
      return next
    })
  }

  const shownApprovedCount = values.filter(v =>
    selected.has(v.value_hash)
  ).length

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
          Back to session
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Review values
        </Typography>
      </Box>

      <Panel title="Candidate">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FieldRow label="Values total">
            <Typography variant="body2">{fmtInt(total)}</Typography>
          </FieldRow>
          <FieldRow label="Ratio by protocol">
            <Typography variant="body2">
              {Object.entries(candidate.ratio_by_protocol)
                .map(([proto, ratio]) => `${proto} ${fmtRatio(ratio)}`)
                .join(' · ') || '—'}
              {candidate.projected_ratio && (
                <Typography
                  component="span"
                  variant="caption"
                  color="warning.main"
                  sx={{ ml: 1 }}
                >
                  (projected — assumes full approval, will drop as values are
                  rejected)
                </Typography>
              )}
            </Typography>
          </FieldRow>
          <FieldRow label="Expires">
            <Typography variant="body2">
              {fmtRelative(candidate.expires_at)}
            </Typography>
          </FieldRow>
        </Box>
      </Panel>

      {deniedSummary && (
        <Panel
          title="Denied before review"
          subtitle="Values the server never proposed, and why — without this the list below looks arbitrary."
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {DENIED_LABELS.map(d => (
              <Tooltip key={d.key} title={d.hint} arrow>
                <Box
                  sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {d.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {fmtInt(deniedSummary[d.key])}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Panel>
      )}

      <Panel
        title="Proposed values"
        subtitle="Ordered by witness count, then contribution. A value many people already saw is a smaller disclosure than one only two people saw — that's why it orders the list. It does not make anything safe on its own; approval is still a per-value decision."
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <TextField
            size="small"
            placeholder="Search value or key path"
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !loading) handleApplyFilters()
            }}
            sx={{ minWidth: 260 }}
          />
          <TextField
            size="small"
            type="number"
            inputProps={{ min: 0 }}
            placeholder="Min witnesses"
            value={minWitnessDraft}
            onChange={e => setMinWitnessDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !loading) handleApplyFilters()
            }}
            sx={{ width: 160 }}
          />
          <IconButton
            size="small"
            onClick={handleApplyFilters}
            disabled={loading}
            aria-label="Apply filters"
          >
            <SearchIcon />
          </IconButton>
          {(searchApplied || minWitnessApplied) && (
            <IconButton
              size="small"
              onClick={handleClearFilters}
              aria-label="Clear filters"
            >
              <ClearIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Checks every row currently shown on this page — a convenience for bulk-approving values above a witness threshold, not a server-side select-all.">
            <span>
              <Button
                variant="tonal"
                color="inherit"
                size="small"
                onClick={selectAllShown}
                disabled={values.length === 0}
              >
                Select shown ({values.length})
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="tonal"
            color="inherit"
            size="small"
            onClick={clearAllShown}
            disabled={shownApprovedCount === 0}
          >
            Unselect shown
          </Button>
        </Box>

        {loading && values.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress disableShrink />
          </Box>
        ) : values.length === 0 ? (
          <EmptyState
            title="No values match"
            hint="Try clearing the search or witness filter."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>Key path</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell align="right">Occurrences</TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        justifyContent: 'flex-end',
                      }}
                    >
                      Witnesses
                      <Tooltip title="Distinct connections that produced this value. Ordering only — a high witness count makes a value a smaller disclosure, not a safe one.">
                        <InfoOutlinedIcon
                          sx={{ fontSize: 14, color: 'text.disabled' }}
                        />
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="right">Contribution</TableCell>
                  <TableCell padding="checkbox"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {values.map(v => {
                  const valueDenied = denied.has(v.value_hash)
                  const fieldDenied = deniedFields.has(v.path)
                  const rowDenied = valueDenied || fieldDenied
                  return (
                    <TableRow
                      key={v.value_hash}
                      hover
                      selected={selected.has(v.value_hash)}
                      sx={rowDenied ? { opacity: 0.6 } : undefined}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.has(v.value_hash)}
                          disabled={rowDenied}
                          inputProps={{
                            'aria-label': `Allow ${v.path} = ${v.value}`,
                          }}
                          onChange={(_, checked) =>
                            toggleValue(v.value_hash, checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {v.path}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.recommended && (
                          <Chip
                            size="small"
                            label="recommended"
                            color="primary"
                            variant="outlined"
                            sx={{ mr: 1 }}
                            title="Measured as worth approving against traffic held back from training. Ticked for you — untick it if it should not be disclosed to this profile's audience."
                          />
                        )}
                        {rowDenied ? (
                          <Chip
                            size="small"
                            label={fieldDenied ? 'field denied' : 'denied'}
                            color="error"
                            variant="outlined"
                            sx={{ mr: 1 }}
                            title={
                              fieldDenied
                                ? `Every value of ${v.path} is denied, in this and later sessions.`
                                : 'Never shown to this profile, and never recommended again.'
                            }
                          />
                        ) : (
                          v.previously_approved && (
                            <Chip
                              size="small"
                              label="approved before"
                              variant="outlined"
                              sx={{ mr: 1 }}
                              title="An earlier review of this profile allowed it, so it arrives ticked."
                            />
                          )
                        )}
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {v.value}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {fmtInt(v.occurrences)}
                      </TableCell>
                      <TableCell align="right">{fmtInt(v.witnesses)}</TableCell>
                      <TableCell align="right">
                        {fmtInt(v.contribution)}
                      </TableCell>
                      <TableCell padding="checkbox">
                        {rowDenied ? (
                          <Tooltip
                            title={
                              fieldDenied
                                ? `Undo denying every value of ${v.path}`
                                : 'Undo the denial - it goes back to not reviewed'
                            }
                          >
                            <IconButton
                              size="small"
                              aria-label={`Undo denial of ${v.path} = ${v.value}`}
                              onClick={() =>
                                fieldDenied
                                  ? setFieldDenied(v.path, false)
                                  : setValueDenied(v.value_hash, false)
                              }
                            >
                              <UndoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Deny - never shown to this profile">
                            <IconButton
                              size="small"
                              aria-label={`Deny ${v.path} = ${v.value}`}
                              onClick={e =>
                                setDenyMenu({
                                  anchor: e.currentTarget,
                                  value: v,
                                })
                              }
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Menu
          anchorEl={denyMenu?.anchor}
          open={denyMenu !== null}
          onClose={() => setDenyMenu(null)}
        >
          <MenuItem
            onClick={() => {
              if (denyMenu) setValueDenied(denyMenu.value.value_hash, true)
              setDenyMenu(null)
            }}
          >
            Deny this value
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (denyMenu) setFieldDenied(denyMenu.value.path, true)
              setDenyMenu(null)
            }}
          >
            Deny every value of&nbsp;
            <Typography component="span" sx={{ fontFamily: 'monospace' }}>
              {denyMenu?.value.path}
            </Typography>
          </MenuItem>
        </Menu>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {fmtInt(total)} values total
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<NavigateBeforeIcon />}
              onClick={handlePrev}
              disabled={loading || cursors.length < 2}
              variant="tonal"
              color="inherit"
            >
              Previous
            </Button>
            <Button
              size="small"
              endIcon={<NavigateNextIcon />}
              onClick={handleNext}
              disabled={loading || !nextCursor}
              variant="tonal"
              color="inherit"
            >
              Next
            </Button>
          </Box>
        </Box>
      </Panel>

      {deniedFields.size > 0 && (
        <Panel
          title="Denied fields"
          subtitle="Every value under these is left out, and training no longer collects them - so they are not in the list above. Remove one to collect it again from the next session."
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Array.from(deniedFields)
              .sort()
              .map(path => (
                <Chip
                  key={path}
                  label={path}
                  color="error"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                  onDelete={() => setFieldDenied(path, false)}
                  deleteIcon={
                    <Tooltip title="Undo - collect this field again">
                      <UndoIcon aria-label={`Undo denying ${path}`} />
                    </Tooltip>
                  }
                />
              ))}
          </Box>
        </Panel>
      )}

      <Panel title="Decision">
        {candidate.size_curve.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Dictionary size to review for"
              value={targetSize}
              onChange={e => handleTargetSize(Number(e.target.value))}
              helperText={
                measured
                  ? 'Every size here was built and measured. Changing it re-ticks the values measured for that size — the two are one answer, so reviewing 60 values for a dictionary with room for 5 would be reviewing the wrong list.'
                  : 'Every size here was built; nothing could be measured. The size decides how many values fit, so pick it before reviewing.'
              }
            >
              {candidate.size_curve.map(p => (
                <MenuItem key={p.size_bytes} value={p.size_bytes}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      width: '100%',
                    }}
                  >
                    <span>{HumanSize(p.size_bytes)}</span>
                    <Typography variant="body2" color="text.secondary">
                      {p.ratio.toFixed(2)}x · {p.recommended_values} value
                      {p.recommended_values === 1 ? '' : 's'} ·{' '}
                      {HumanSize(p.delivery_bytes)} per cold connect
                    </Typography>
                    {candidate.recommended_size === p.size_bytes && (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label="Recommended"
                        sx={{ ml: 'auto' }}
                      />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}
        {candidate.recommended_count > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>
              {fmtInt(candidate.recommended_count)} values are selected for you
              {candidate.recommended_ratio > 0 &&
                `, measured at ${candidate.recommended_ratio.toFixed(2)}x`}
              {candidate.recommended_size > 0 &&
                ` in a ${HumanSize(candidate.recommended_size)} dictionary`}
              .
            </strong>{' '}
            {measured
              ? 'This session held back its last quarter and the build tried several cut-offs and sizes against it — traffic no dictionary here was built from — so this is what the selection actually achieved, not what it is projected to. Approving more is usually worse: past the peak, extra values push the useful fragments out of range and the ratio falls. Read these, untick anything that should not be disclosed, and approve.'
              : 'This session was stopped before its last quarter, which is held back to measure the result, so nothing here is measured. Selected are the values that fit in the dictionary. Read them, untick anything that should not be disclosed, and approve, or train again and let the session reach its deadline.'}
            {measured && candidate.recommended_size > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                The size and the selection are one answer: this many values was
                the best cut-off <em>at that size</em>. Pick another size above
                and the ticks follow it.
              </Typography>
            )}
          </Alert>
        )}
        {preview && (
          <Alert
            severity={
              preview.values_held < preview.values_offered
                ? 'warning'
                : 'success'
            }
            sx={{ mb: 2, opacity: previewStale ? 0.6 : 1 }}
          >
            <strong>
              What you have ticked: {HumanSize(preview.artifact_bytes)}{' '}
              dictionary
              {(preview.ratio_by_protocol?.json ?? 0) > 0 &&
                `, ${preview.ratio_by_protocol.json.toFixed(2)}x`}
              , {HumanSize(preview.delivery_bytes)} per cold connect.
            </strong>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {preview.values_held < preview.values_offered ? (
                <>
                  Only {preview.values_held} of your {preview.values_offered}{' '}
                  ticked values fit in {HumanSize(targetSize)}. The rest stay
                  allowed but are not in the dictionary — a larger size later
                  can use them without another review.
                </>
              ) : (
                <>
                  All {preview.values_held} fit. Ticking more raises the ratio
                  while there is room; past {HumanSize(targetSize)} the rest
                  stay allowed but are left out of the dictionary.
                </>
              )}
            </Typography>
          </Alert>
        )}
        {totalContribution > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                mb: 0.5,
              }}
            >
              <Typography variant="body2">
                Selected values cover{' '}
                <strong>{Math.round(coverage * 100)}%</strong> of the saving
                this vocabulary can give.
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" onClick={() => selectTopUpTo(0.8)}>
                Take top 80%
              </Button>
              <Button size="small" onClick={() => selectTopUpTo(0.95)}>
                95%
              </Button>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(coverage * 100, 100)}
              sx={{ height: 6, borderRadius: 3 }}
            />
            {/* Values are listed best-first, so this climbs steeply and then
                flattens. Where it flattens is where reading further stops
                paying - which is the whole point of showing it. */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5 }}
            >
              Values are listed most valuable first, so this rises quickly and
              then flattens. Once it has flattened, the rows below are worth
              little and can be left unapproved.
            </Typography>
          </Box>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>
            {fmtInt(selected.size)} allowed · {fmtInt(denied.size)} denied
            {deniedFields.size > 0 &&
              ` · ${fmtInt(deniedFields.size)} field${deniedFields.size === 1 ? '' : 's'} denied`}
          </strong>
          {' — '}
          only allowed values can go into the dictionary. Everything else is not
          reviewed: it isn&apos;t used, isn&apos;t remembered, and is offered
          again next time.
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="tonal"
            color="inherit"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            startIcon={
              savingDraft ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {savingDraft ? 'Saving…' : 'Save draft'}
          </Button>
          <Button
            variant="solid"
            color="primary"
            onClick={() => setApproveOpen(true)}
          >
            Approve…
          </Button>
        </Box>
      </Panel>

      <ApproveCandidateDialog
        api={api}
        open={approveOpen}
        candidateId={candidate.id}
        approvedHashes={Array.from(selected)}
        deniedHashes={Array.from(denied)}
        deniedFields={Array.from(deniedFields)}
        sizeBytes={targetSize}
        defaultProfileId={defaultProfileId}
        onClose={() => setApproveOpen(false)}
        onApproved={created => {
          setApproveOpen(false)
          showAlert(
            created.activatedPercent != null
              ? `Candidate approved — new version activated for ${created.activatedPercent}% of matching connections`
              : 'Candidate approved — new version created',
            { severity: 'success' }
          )
          onApproved(created)
        }}
      />
    </Box>
  )
}
