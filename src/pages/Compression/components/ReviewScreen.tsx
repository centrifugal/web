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
import Collapse from '@mui/material/Collapse'
import Paper from '@mui/material/Paper'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
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
  CandidateField,
  CandidateValue,
  DeniedSummary,
  GetCandidateValuesParams,
} from '../api'
import { fmtInt, fmtRatio, fmtRelative } from '../format'
import { ApproveCandidateDialog } from './ApproveCandidateDialog'
import { FieldCrumb, FieldReview } from './FieldReview'
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

  // On a retrain most rows were decided last time; this narrows the list to
  // the ones that were not. Read through a ref so every fetch path honours it.
  const [newOnly, setNewOnly] = useState(false)
  // The review is by field unless the operator opens one field, or asks for
  // every value. fieldRef carries the opened field into every fetch.
  const [view, setView] = useState<'fields' | 'values'>('fields')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [fields, setFields] = useState<CandidateField[]>([])
  const [fieldPath, setFieldPath] = useState<string | null>(null)
  const fieldRef = useRef<string | null>(null)
  const newOnlyRef = useRef(false)
  const [newTotal, setNewTotal] = useState(0)
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
    // A retrain: most of the list was decided last time, so it opens on what
    // is new. The full list is one click away.
    if (
      (prior.allowed?.length ?? 0) +
        (prior.denied?.length ?? 0) +
        (prior.denied_fields?.length ?? 0) >
      0
    ) {
      newOnlyRef.current = true
      setNewOnly(true)
    }
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
        if (newOnlyRef.current) params.new_only = true
        if (fieldRef.current) params.path = fieldRef.current
        const data = await api.getCandidateValues(candidate.id, params)
        const rows = data.values || []
        setValues(rows)
        setTotal(data.total)
        setNewTotal(data.new_total ?? 0)
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

  useEffect(() => {
    let cancelled = false
    api
      .getCandidateFields(candidate.id)
      .then(r => {
        if (cancelled) return
        const fs = r.fields ?? []
        fs.forEach(f => f.hashes.forEach(h => pathRef.current.set(h, f.path)))
        setFields(fs)
      })
      .catch(err => {
        if (!cancelled) api.handleError(err)
      })
    return () => {
      cancelled = true
    }
  }, [api, candidate.id])

  const allowField = (f: CandidateField, allow: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      f.hashes.forEach(h => {
        if (!allow) next.delete(h)
        else if (!denied.has(h)) next.add(h)
      })
      return next
    })
  }
  const openField = (path: string | null) => {
    fieldRef.current = path
    setFieldPath(path)
    setView(path === null ? 'fields' : 'values')
    if (path !== null) {
      fetchValues({
        direction: 'first',
        search: searchApplied,
        minWitness: minWitnessApplied,
      })
    }
  }
  const showAllValues = () => {
    fieldRef.current = null
    setFieldPath(null)
    setView('values')
    fetchValues({
      direction: 'first',
      search: searchApplied,
      minWitness: minWitnessApplied,
    })
  }
  const fieldsNew = fields.reduce((n, f) => n + f.new, 0)

  const handleNewOnly = (on: boolean) => {
    newOnlyRef.current = on
    setNewOnly(on)
    fetchValues({
      direction: 'first',
      search: searchApplied,
      minWitness: minWitnessApplied,
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

  const fieldPaths = new Set(fields.map(f => f.path))
  const unseenDeniedFields = Array.from(deniedFields)
    .filter(p => !fieldPaths.has(p))
    .sort()
  const deniedCount = denied.size + deniedFields.size
  const notFitting =
    preview !== null && preview.values_held < preview.values_offered
  const previewRatio = preview?.ratio_by_protocol?.json ?? 0

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
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Review values
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fmtInt(candidate.values_total)} values in {fmtInt(fields.length)}{' '}
            field{fields.length === 1 ? '' : 's'} ·{' '}
            {measured ? 'measured on held-back traffic' : 'not measured'} · open
            until {fmtRelative(candidate.expires_at)}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          variant="text"
          color="inherit"
          onClick={() => setDetailsOpen(o => !o)}
          aria-expanded={detailsOpen}
        >
          {detailsOpen ? 'Hide details' : 'Details'}
        </Button>
      </Box>

      <Collapse in={detailsOpen} unmountOnExit>
        <Panel title="Details">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2">
              {candidate.recommended_count > 0
                ? measured
                  ? `${fmtInt(candidate.recommended_count)} values were pre-selected by building several dictionaries and measuring each on the last quarter of the session, which none was built from. More is usually worse: past the best cut-off, extra values push the useful ones out of reach.`
                  : `${fmtInt(candidate.recommended_count)} values were pre-selected because they fit the dictionary. The session ended before enough traffic was held back to measure the result; train longer for a measured selection.`
                : 'Nothing was pre-selected: the build had nothing to measure a selection against.'}{' '}
              Size and selection go together: picking another size re-selects
              what was measured for it.
            </Typography>
            <FieldRow label="Ratio by protocol">
              <Typography variant="body2">
                {Object.entries(candidate.ratio_by_protocol)
                  .map(([proto, ratio]) => `${proto} ${fmtRatio(ratio)}`)
                  .join(' · ') || '—'}
                {candidate.projected_ratio && ' (if every value were allowed)'}
              </Typography>
            </FieldRow>
            {deniedSummary && (
              <FieldRow label="Refused before review">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {DENIED_LABELS.map(d => (
                    <Tooltip key={d.key} title={d.hint} arrow>
                      <Typography variant="body2">
                        {d.label}{' '}
                        <strong>{fmtInt(deniedSummary[d.key])}</strong>
                      </Typography>
                    </Tooltip>
                  ))}
                </Box>
              </FieldRow>
            )}
            {totalContribution > 0 && (
              <FieldRow label="Saving covered">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(coverage * 100, 100)}
                    sx={{ height: 6, borderRadius: 3, width: 160 }}
                  />
                  <Typography variant="body2">
                    {Math.round(coverage * 100)}% of what these values can save
                  </Typography>
                  <Button size="small" onClick={() => selectTopUpTo(0.8)}>
                    Allow top 80%
                  </Button>
                  <Button size="small" onClick={() => selectTopUpTo(0.95)}>
                    95%
                  </Button>
                </Box>
              </FieldRow>
            )}
          </Box>
        </Panel>
      </Collapse>

      <Panel
        title={
          view === 'values' && fieldPath
            ? 'Values'
            : view === 'fields'
              ? 'Fields'
              : 'All values'
        }
        subtitle={
          view === 'fields'
            ? 'Tick a field to allow its values, deny it to never show or collect it, or open it to decide value by value.'
            : 'Most seen first. Tick to allow; deny what must never be shown.'
        }
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v) => {
              if (v === 'fields') openField(null)
              else if (v === 'values') showAllValues()
            }}
          >
            <ToggleButton value="fields">By field</ToggleButton>
            <ToggleButton value="values">All values</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        {view === 'fields' && (
          <>
            {(newOnly || fieldsNew < candidate.values_total) && (
              <Box sx={{ mb: 1.5 }}>
                <Chip
                  label={
                    newOnly
                      ? `New only (${fmtInt(fieldsNew)}) — show all`
                      : `New only (${fmtInt(fieldsNew)})`
                  }
                  color={newOnly ? 'primary' : 'default'}
                  variant={newOnly ? 'filled' : 'outlined'}
                  onClick={() => handleNewOnly(!newOnly)}
                  title="Values no earlier review of this profile decided."
                />
              </Box>
            )}
            <FieldReview
              fields={fields}
              selected={selected}
              denied={denied}
              deniedFields={deniedFields}
              unseenDeniedFields={unseenDeniedFields}
              newOnly={newOnly}
              onAllow={allowField}
              onDenyField={setFieldDenied}
              onShowValues={path => openField(path)}
            />
          </>
        )}
        {view === 'values' && fieldPath && (
          <FieldCrumb path={fieldPath} onBack={() => openField(null)} />
        )}
        {view === 'values' && (
          <>
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
              {(newOnly || newTotal < candidate.values_total) && (
                <Tooltip title="Values no earlier review of this profile allowed or denied - on a retrain, the only rows that need reading.">
                  <Chip
                    label={
                      newOnly
                        ? `New only (${fmtInt(newTotal)}) — show all`
                        : `New only (${fmtInt(newTotal)})`
                    }
                    color={newOnly ? 'primary' : 'default'}
                    variant={newOnly ? 'filled' : 'outlined'}
                    onClick={() => handleNewOnly(!newOnly)}
                  />
                </Tooltip>
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
                          <TableCell align="right">
                            {fmtInt(v.witnesses)}
                          </TableCell>
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
          </>
        )}
      </Panel>

      <Paper
        variant="outlined"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 260 }}>
            <Typography variant="body1">
              <strong>{fmtInt(selected.size)}</strong> allowed ·{' '}
              <strong>{fmtInt(deniedCount)}</strong> denied
              {preview && (
                <Typography
                  component="span"
                  color="text.secondary"
                  sx={{ opacity: previewStale ? 0.6 : 1 }}
                >
                  {' '}
                  → {HumanSize(preview.artifact_bytes)} dictionary
                  {previewRatio > 0 && `, ${previewRatio.toFixed(2)}x`}
                  {!preview.measured && ' (not measured)'}
                </Typography>
              )}
            </Typography>
            <Typography
              variant="caption"
              color={notFitting ? 'warning.main' : 'text.secondary'}
            >
              {notFitting
                ? `${fmtInt(preview.values_offered - preview.values_held)} allowed values don't fit at this size; they stay allowed for a larger one.`
                : 'Only allowed values ship. Values left unticked are asked about again next time.'}
            </Typography>
          </Box>
          {candidate.size_curve.length > 0 && (
            <TextField
              select
              size="small"
              label="Size"
              value={targetSize}
              onChange={e => handleTargetSize(Number(e.target.value))}
              sx={{ width: 170 }}
              SelectProps={{
                renderValue: v =>
                  `${HumanSize(Number(v))}${
                    Number(v) === candidate.recommended_size
                      ? ' (recommended)'
                      : ''
                  }`,
              }}
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
                      {HumanSize(p.delivery_bytes)} per new connection
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
          )}
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
      </Paper>

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
              ? `Approved — the new version serves ${created.activatedPercent}% of matching connections`
              : 'Approved — a new version was created',
            { severity: 'success' }
          )
          onApproved(created)
        }}
      />
    </Box>
  )
}
