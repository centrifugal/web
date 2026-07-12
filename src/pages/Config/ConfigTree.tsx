import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LinkIcon from '@mui/icons-material/Link'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SearchOffIcon from '@mui/icons-material/SearchOff'

import { EmptyState } from 'components/EmptyState'

import { ConfigNode } from './types'

const LONG = 120
const GUTTER = '22px'
const STORAGE_KEY = 'centrifugo.config.tree'
const STATE_VERSION = 1

const childrenOf = (n: ConfigNode): ConfigNode[] | undefined =>
  n.children ?? n.items
const isLongString = (v: unknown): v is string =>
  typeof v === 'string' && (v.length > LONG || v.includes('\n'))

// Searchable text for a node — keys, plain values, url displays, human values, docs.
const textOf = (n: ConfigNode): string => {
  const parts: string[] = [n.key]
  if (typeof n.value === 'string') parts.push(n.value)
  if (n.kind === 'url' && n.display) parts.push(n.display)
  if (n.human) parts.push(n.human)
  if (n.doc?.description) parts.push(n.doc.description)
  if (n.doc?.env) parts.push(n.doc.env)
  return parts.join(' ').toLowerCase()
}

const subtreeMatches = (n: ConfigNode, q: string): boolean => {
  if (!q) return true
  if (textOf(n).includes(q)) return true
  const kids = childrenOf(n)
  return !!kids && kids.some(k => subtreeMatches(k, q))
}

const hasNonDefault = (n: ConfigNode): boolean => {
  const kids = childrenOf(n)
  if (kids) return kids.some(hasNonDefault)
  return n.overridden === true
}

const collectContainers = (
  nodes: ConfigNode[],
  parent: string,
  out: string[]
) => {
  for (const n of nodes) {
    const path = parent ? `${parent}.${n.key}` : n.key
    const kids = childrenOf(n)
    if (kids) {
      out.push(path)
      collectContainers(kids, path, out)
    }
  }
}

// Paths of descendant containers that form a single-element chain — expanding a
// node auto-opens these (a one-element array/object is usually a single value).
const collectSingleChain = (node: ConfigNode, path: string, out: string[]) => {
  const kids = childrenOf(node)
  if (!kids) return
  for (const child of kids) {
    const ck = childrenOf(child)
    if (ck && ck.length === 1) {
      const childPath = `${path}.${child.key}`
      out.push(childPath)
      collectSingleChain(child, childPath, out)
    }
  }
}

// --- persisted UI state (versioned, fail-safe to defaults) ---
interface PersistedState {
  collapsed: Set<string>
  nonDefaultOnly: boolean
}
const loadState = (): PersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { collapsed: new Set(), nonDefaultOnly: false }
    const p = JSON.parse(raw)
    if (!p || p.v !== STATE_VERSION)
      return { collapsed: new Set(), nonDefaultOnly: false }
    return {
      collapsed: Array.isArray(p.collapsed)
        ? new Set<string>(p.collapsed)
        : new Set(),
      nonDefaultOnly: p.nonDefaultOnly === true,
    }
  } catch {
    return { collapsed: new Set(), nonDefaultOnly: false }
  }
}
const saveState = (collapsed: Set<string>, nonDefaultOnly: boolean) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: STATE_VERSION,
        collapsed: Array.from(collapsed),
        nonDefaultOnly,
      })
    )
  } catch {
    /* ignore */
  }
}

interface TreeCtx {
  q: string
  nonDefaultOnly: boolean
  collapsed: Set<string>
  toggle: (p: string, node?: ConfigNode) => void
  target: string | null
  goto: (p: string) => void
}
const Ctx = createContext<TreeCtx>({
  q: '',
  nonDefaultOnly: false,
  collapsed: new Set(),
  toggle: () => {},
  target: null,
  goto: () => {},
})

const REDACTION_HELP =
  'Read-only, redacted view of the effective configuration on this node. Secret values are masked on the server and never sent to the browser.'

const chipSx = {
  height: 22,
  fontFamily: 'monospace',
  '& .MuiChip-label': { px: 0.9 },
  '& .MuiChip-icon': { ml: 0.6, mr: -0.2 },
}

const Empty = () => (
  <Box
    component="em"
    sx={{ color: 'text.disabled', fontFamily: 'monospace', opacity: 0.7 }}
  >
    empty
  </Box>
)

const RedactedLeaf = ({ node }: { node: ConfigNode }) => {
  const { kind, set, display } = node
  if (!set) return <Empty />

  if (kind === 'url') {
    return (
      <Tooltip title="Credentials in this URL / DSN are masked">
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontFamily: 'monospace',
            color: 'info.main',
            wordBreak: 'break-all',
          }}
        >
          <LinkIcon sx={{ fontSize: 14, flexShrink: 0 }} />
          {display}
        </Box>
      </Tooltip>
    )
  }
  return (
    <Tooltip title="Secret — value is redacted on the server">
      <Chip
        size="small"
        variant="outlined"
        color="warning"
        icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
        label={display}
        sx={chipSx}
      />
    </Tooltip>
  )
}

const LongValue = ({ value }: { value: string }) => (
  <Box
    sx={{
      fontFamily: 'monospace',
      fontSize: 12,
      color: 'primary.main',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      maxHeight: 160,
      overflow: 'auto',
      bgcolor: 'action.hover',
      borderRadius: 1,
      p: 1,
      mt: 0.5,
    }}
  >
    {value}
  </Box>
)

const ScalarValue = ({ node }: { node: ConfigNode }) => {
  if (node.kind === 'bool')
    return (
      <Box
        component="span"
        sx={{
          color: node.value ? 'success.main' : 'error.main',
          fontFamily: 'monospace',
        }}
      >
        {String(node.value)}
      </Box>
    )
  if (node.kind === 'number')
    return (
      <Box
        component="span"
        sx={{ color: 'primary.main', fontFamily: 'monospace' }}
      >
        {String(node.value)}
      </Box>
    )
  if (node.kind === 'null' || node.value === null)
    return (
      <Box
        component="span"
        sx={{ color: 'text.disabled', fontFamily: 'monospace' }}
      >
        null
      </Box>
    )
  const text = node.value as string
  if (text === '') return <Empty />
  return (
    <Box
      component="span"
      sx={{
        color: 'primary.main',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
      }}
    >
      {text}
    </Box>
  )
}

// Renders a description, converting <<code>> markers into inline code.
const renderDescription = (text: string) =>
  text.split(/<<(.+?)>>/g).map((part, i) =>
    i % 2 === 1 ? (
      <Box
        key={i}
        component="code"
        sx={{
          fontFamily: 'monospace',
          bgcolor: 'rgba(255,255,255,0.12)',
          px: 0.5,
          borderRadius: 0.5,
        }}
      >
        {part}
      </Box>
    ) : (
      <span key={i}>{part}</span>
    )
  )

const DocTip = ({ node }: { node: ConfigNode }) => {
  const d = node.doc!
  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ fontSize: 12, lineHeight: 1.5 }}>
          {d.description && (
            <Box sx={{ mb: 0.5 }}>{renderDescription(d.description)}</Box>
          )}
          {d.type && (
            <Box sx={{ fontFamily: 'monospace', opacity: 0.85 }}>
              type: {d.type}
            </Box>
          )}
          {d.default !== undefined && (
            <Box sx={{ fontFamily: 'monospace', opacity: 0.85 }}>
              default: {JSON.stringify(d.default)}
            </Box>
          )}
          {d.env && (
            <Box sx={{ fontFamily: 'monospace', opacity: 0.85 }}>
              env: {d.env}
            </Box>
          )}
        </Box>
      }
    >
      <InfoOutlinedIcon
        sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
      />
    </Tooltip>
  )
}

const MetaIcons = ({ node, path }: { node: ConfigNode; path: string }) => {
  const { goto } = useContext(Ctx)
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}
    >
      {node.doc && <DocTip node={node} />}
      <Tooltip title="Copy link to this field">
        <IconButton
          size="small"
          onClick={() => {
            // Jump to the field and copy a shareable deep link. The app uses a
            // HashRouter, so the path param lives inside the hash portion.
            goto(path)
            const hashBase = window.location.hash.split('?')[0] || '#/'
            const url = `${window.location.origin}${
              window.location.pathname
            }${hashBase}?path=${encodeURIComponent(path)}`
            void navigator.clipboard?.writeText(url)
          }}
          sx={{ p: 0.25, opacity: 0.35, '&:hover': { opacity: 1 } }}
        >
          <LinkIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

const KeyLabel = ({ name }: { name: string }) => (
  <Box
    component="span"
    sx={{
      fontFamily: 'monospace',
      color: 'text.secondary',
      fontWeight: 600,
      mr: 1,
    }}
  >
    {name}:
  </Box>
)

const LeafRow = ({ node, path }: { node: ConfigNode; path: string }) => {
  const { target } = useContext(Ctx)
  const highlight = target === path
  const long = node.kind === 'string' && isLongString(node.value)
  return (
    <Box
      id={`cfg-${path}`}
      sx={{
        borderRadius: 1,
        bgcolor: highlight ? 'action.selected' : 'transparent',
        transition: 'background-color .4s',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 26,
          py: 0.25,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ width: GUTTER, flexShrink: 0 }} />
        <KeyLabel name={node.key} />
        {!long &&
          (node.kind === 'secret' || node.kind === 'url' ? (
            <RedactedLeaf node={node} />
          ) : (
            <ScalarValue node={node} />
          ))}
        <MetaIcons node={node} path={path} />
      </Box>
      {long && (
        <Box sx={{ pl: GUTTER }}>
          <LongValue value={node.value as string} />
        </Box>
      )}
    </Box>
  )
}

const Section = ({
  node,
  path,
  count,
}: {
  node: ConfigNode
  path: string
  count: number
}) => {
  const { q, collapsed, toggle, target } = useContext(Ctx)
  const onTargetPath =
    !!target && (target === path || target.startsWith(path + '.'))
  const forced = !!q || onTargetPath
  const expanded = forced || !collapsed.has(path)
  const kids = childrenOf(node)!
  const hint = node.kind === 'array' ? `[${count}]` : `{${count}}`
  return (
    <Box id={`cfg-${path}`}>
      <Box
        onClick={() => !forced && toggle(path, node)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 26,
          py: 0.25,
          cursor: forced ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        <ChevronRightIcon
          sx={{
            fontSize: 16,
            mr: 0.5,
            flexShrink: 0,
            color: 'text.disabled',
            transition: 'transform .15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
        />
        <Box
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: 'text.primary',
          }}
        >
          {node.key}
        </Box>
        <Box
          component="span"
          sx={{
            ml: 1,
            color: 'text.disabled',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {hint}
        </Box>
        <MetaIcons node={node} path={path} />
      </Box>
      {expanded && (
        <Box
          sx={{
            pl: 1.5,
            ml: '10px',
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}
        >
          {kids.map(k => (
            <TreeField key={k.key} node={k} parent={path} />
          ))}
        </Box>
      )}
    </Box>
  )
}

const TreeField = ({ node, parent }: { node: ConfigNode; parent: string }) => {
  const { q, nonDefaultOnly } = useContext(Ctx)
  const path = parent ? `${parent}.${node.key}` : node.key
  if (q && !subtreeMatches(node, q)) return null
  if (nonDefaultOnly && !hasNonDefault(node)) return null

  // Container-ness comes from kind, not from the presence of children/items: the
  // server omits empty items/children arrays (omitempty), so an empty array still
  // arrives as kind 'array' with no items and must render as `[]`, not a blank leaf.
  const isContainer = node.kind === 'array' || node.kind === 'object'
  const kids = childrenOf(node)
  if (isContainer) {
    if (!kids || kids.length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 26,
            py: 0.25,
          }}
        >
          <Box sx={{ width: GUTTER, flexShrink: 0 }} />
          <KeyLabel name={node.key} />
          <Box
            component="span"
            sx={{ color: 'text.disabled', fontFamily: 'monospace' }}
          >
            {node.kind === 'array' ? '[]' : '{}'}
          </Box>
          <MetaIcons node={node} path={path} />
        </Box>
      )
    }
    return <Section node={node} path={path} count={kids.length} />
  }
  return <LeafRow node={node} path={path} />
}

export const ConfigTree = ({ fields }: { fields: ConfigNode[] }) => {
  const [query, setQuery] = useState('')
  const [nonDefaultOnly, setNonDefaultOnly] = useState(
    () => loadState().nonDefaultOnly
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => loadState().collapsed
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const q = query.trim().toLowerCase()
  const target = searchParams.get('path')

  useEffect(
    () => saveState(collapsed, nonDefaultOnly),
    [collapsed, nonDefaultOnly]
  )

  // Scroll a deep-linked field into view once its ancestors are expanded.
  useEffect(() => {
    if (!target) return
    const id = requestAnimationFrame(() =>
      document
        .getElementById(`cfg-${target}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    )
    return () => cancelAnimationFrame(id)
  }, [target])

  const toggle = (p: string, node?: ConfigNode) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(p)) {
        // opening — also reveal single-element descendant chains
        next.delete(p)
        if (node) {
          const chain: string[] = []
          collectSingleChain(node, p, chain)
          chain.forEach(c => next.delete(c))
        }
      } else {
        next.add(p)
      }
      return next
    })
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => {
    const all: string[] = []
    collectContainers(fields, '', all)
    setCollapsed(new Set(all))
  }
  const goto = (p: string) =>
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('path', p)
      return next
    })

  // Top-level fields actually rendered — mirrors the guards in TreeField so the
  // empty state shows when the filter / non-defaults toggle hides everything.
  const visibleCount = useMemo(
    () =>
      fields.filter(
        n =>
          (!q || subtreeMatches(n, q)) && (!nonDefaultOnly || hasNonDefault(n))
      ).length,
    [fields, q, nonDefaultOnly]
  )

  const ctx = useMemo(
    () => ({ q, nonDefaultOnly, collapsed, toggle, target, goto }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, nonDefaultOnly, collapsed, target]
  )

  return (
    <Ctx.Provider value={ctx}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Filter by key or value…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <Button
          size="small"
          variant="tonal"
          color="inherit"
          startIcon={<UnfoldMoreIcon />}
          onClick={expandAll}
        >
          Expand all
        </Button>
        <Button
          size="small"
          variant="tonal"
          color="inherit"
          startIcon={<UnfoldLessIcon />}
          onClick={collapseAll}
        >
          Collapse all
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 0.5 }} />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={nonDefaultOnly}
              onChange={e => setNonDefaultOnly(e.target.checked)}
            />
          }
          label="Only non-defaults"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small"
          variant="outlined"
          color="warning"
          icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
          label="secret"
          sx={chipSx}
        />
        <Chip
          size="small"
          variant="outlined"
          color="info"
          icon={<LinkIcon sx={{ fontSize: 14 }} />}
          label="url / dsn"
          sx={chipSx}
        />
        <Tooltip title={REDACTION_HELP}>
          <InfoOutlinedIcon
            sx={{ fontSize: 18, color: 'text.disabled', cursor: 'help' }}
          />
        </Tooltip>
      </Box>
      <Box sx={{ fontSize: 14, lineHeight: 1.6 }}>
        {visibleCount === 0 ? (
          <EmptyState
            icon={<SearchOffIcon sx={{ fontSize: 40 }} />}
            title="No matching options"
            hint={
              nonDefaultOnly && q
                ? 'No non-default options match your filter. Try a different term or turn off “Only non-defaults”.'
                : nonDefaultOnly
                  ? 'All options are at their default values.'
                  : 'No configuration options match your filter.'
            }
          />
        ) : (
          fields.map(n => <TreeField key={n.key} node={n} parent="" />)
        )}
      </Box>
    </Ctx.Provider>
  )
}
