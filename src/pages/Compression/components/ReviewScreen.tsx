import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
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

import { ShellContext } from 'contexts/ShellContext'
import { HumanSize } from 'utils/Functions'
import { Panel, FieldRow } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'

import {
  CompressionApiHook,
  Candidate,
  CandidateValue,
  DeniedSummary,
  GetCandidateValuesParams,
} from '../api'
import { fmtInt, fmtRatio, fmtRelative } from '../format'
import { ApproveCandidateDialog } from './ApproveCandidateDialog'

const PAGE_SIZE = 50

interface ReviewScreenProps {
  api: CompressionApiHook
  candidate: Candidate
  onBack: () => void
  onCandidateUpdated: (c: Candidate) => void
  onApproved: () => void
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
    label: 'Already rejected',
    hint: 'You turned these down for this profile before. They are still listed, marked "rejected before" - tick one to approve it after all.',
  },
]

// ReviewScreen: the value-by-value approval gate between a training session
// and a served dictionary. The two rules that make this screen safe rather
// than a rubber stamp:
//
// 1. Nothing starts checked. A value only becomes "approved" because the
//    operator checked it (or it was checked and saved in an earlier draft
//    pass) — never as a default.
// 2. The approve request carries only the checked set. Everything else,
//    including values on a page the operator never opened, is recorded as
//    rejected. That's the API contract, not a UI choice, so this screen
//    cannot construct a request that approves something unseen.
export const ReviewScreen = ({
  api,
  candidate,
  onBack,
  onCandidateUpdated,
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

  // Every value_hash the operator has explicitly approved, accumulated across
  // pages and searches for the lifetime of this screen. This is the only
  // input to the approve request.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The build's measured recommendation, applied once when the screen opens on
  // an untouched candidate. A saved draft always wins: an operator who has
  // already made decisions must not have them replaced by a machine's.
  //
  // Seeded from the hashes the build chose, not from the rows on screen: the
  // list is paged 50 at a time, so seeding from the loaded page ticked 50 of a
  // 60-value recommendation and left the rest looking rejected on page two.
  const recommendedRef = useRef(false)
  useEffect(() => {
    if (recommendedRef.current) return
    const hashes = candidate.recommended_hashes
    if (!hashes || hashes.length === 0) return
    if (candidate.draft_count > 0) return
    recommendedRef.current = true
    setSelected(prev => (prev.size > 0 ? prev : new Set(hashes)))
  }, [candidate.recommended_hashes, candidate.draft_count])

  // Guards re-seeding `selected` from a prior draft's `decided` flag more than
  // once per value, so paging back to a page the operator already unchecked a
  // box on doesn't silently re-check it.
  const seenRef = useRef<Set<string>>(new Set())

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
        if (opts.direction === 'next') {
          setCursors(prev => [...prev, opts.cursor || ''])
        } else if (opts.direction === 'prev') {
          setCursors(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
        } else {
          setCursors([''])
        }

        // Seed selection from prior decisions, once per value ever seen.
        const newlyApproved: string[] = []
        rows.forEach(v => {
          if (!seenRef.current.has(v.value_hash)) {
            seenRef.current.add(v.value_hash)
            if (v.decided === true) newlyApproved.push(v.value_hash)
          }
        })
        if (newlyApproved.length > 0) {
          setSelected(prev => {
            const next = new Set(prev)
            newlyApproved.forEach(h => next.add(h))
            return next
          })
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

  const toggleValue = (hash: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(hash)
      else next.delete(hash)
      return next
    })
  }

  const selectAllShown = () => {
    setSelected(prev => {
      const next = new Set(prev)
      values.forEach(v => next.add(v.value_hash))
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
      const updated = await api.draftCandidate(
        candidate.id,
        Array.from(selected)
      )
      onCandidateUpdated(updated)
      showAlert(
        `Draft saved — ${selected.size.toLocaleString()} approved so far. Review window extended to ${fmtRelative(updated.expires_at)}.`,
        { severity: 'success' }
      )
    } catch (err) {
      api.handleError(err)
    } finally {
      setSavingDraft(false)
    }
  }

  // Against the candidate's whole vocabulary, never the filtered page count.
  // `total` narrows with a search or witness filter, so counting against it
  // reported almost nothing rejected at exactly the moment thousands were -
  // the operator has looked at a slice and is about to reject the rest, which
  // is precisely what this number exists to tell them.
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
        if (!next.has(v.value_hash)) {
          next.add(v.value_hash)
          running += v.contribution
        }
      }
      return next
    })
  }

  const rejectedCount = Math.max(candidate.values_total - selected.size, 0)
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
          Review candidate — {candidate.fidelity}
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
                </TableRow>
              </TableHead>
              <TableBody>
                {values.map(v => (
                  <TableRow
                    key={v.value_hash}
                    hover
                    selected={selected.has(v.value_hash)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(v.value_hash)}
                        inputProps={{
                          'aria-label': `Approve ${v.path} = ${v.value}`,
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
                      {v.previously_denied && (
                        <Chip
                          size="small"
                          label="rejected before"
                          color="warning"
                          variant="outlined"
                          sx={{ mr: 1 }}
                          title="You turned this down in an earlier review for this profile. Tick it to approve it after all."
                        />
                      )}
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {v.value}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{fmtInt(v.occurrences)}</TableCell>
                    <TableCell align="right">{fmtInt(v.witnesses)}</TableCell>
                    <TableCell align="right">
                      {fmtInt(v.contribution)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

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

      <Panel title="Decision">
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
            This session held back its last quarter and the build tried several
            cut-offs and sizes against it — traffic no dictionary here was built
            from — so this is what the selection actually achieved, not what it
            is projected to. Approving more is usually worse: past the peak,
            extra values push the useful fragments out of range and the ratio
            falls. Read these, untick anything that should not be disclosed, and
            approve.
            {candidate.recommended_size > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                The size and the selection are one answer: this many values was
                the best cut-off <em>at that size</em>. The approve dialog
                defaults to it, and the candidate&apos;s size curve shows what
                every other rung was measured at.
              </Typography>
            )}
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
        <Alert
          severity={rejectedCount > 0 ? 'warning' : 'success'}
          sx={{ mb: 2 }}
        >
          <strong>
            {fmtInt(selected.size)} approved, {fmtInt(rejectedCount)} rejected
          </strong>
          {' — '}
          rejected includes every value on a page not yet opened. Only what
          you've checked will be approved.
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
        totalValues={candidate.values_total}
        sizeCurve={candidate.size_curve}
        recommendedSize={candidate.recommended_size}
        onClose={() => setApproveOpen(false)}
        onApproved={() => {
          setApproveOpen(false)
          showAlert('Candidate approved — new version created', {
            severity: 'success',
          })
          onApproved()
        }}
      />
    </Box>
  )
}
