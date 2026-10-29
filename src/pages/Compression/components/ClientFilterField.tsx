import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'

import { ClientFilter, ClientFilterMode } from '../api'

// The names official SDKs send unless an application sets its own - the same
// list Centrifugo's metrics recognise. Any other name can be typed.
const SDK_NAMES = [
  'js',
  'dart',
  'swift',
  'java',
  'go',
  'python',
  'spinify',
  'csharp',
  'rust',
]

// A client that sends no name. Stored as the empty string, shown as a
// placeholder so it can not be mistaken for a client that sends a name
// spelled like one.
const NO_NAME = ''

const MODES: { value: ClientFilterMode; label: string }[] = [
  { value: 'all', label: 'All clients' },
  { value: 'only', label: 'Only' },
  { value: 'except', label: 'All except' },
]

const nameLabel = (name: string) => (name === NO_NAME ? 'no name' : name)

const sameFilter = (a: ClientFilter, b: ClientFilter) =>
  a.mode === b.mode &&
  a.clients.length === b.clients.length &&
  a.clients.every((c, i) => c.name === b.clients[i].name)

interface ClientFilterFieldProps {
  value: ClientFilter
  disabled: boolean
  onSave: (filter: ClientFilter) => Promise<void>
}

// ClientFilterField edits which clients are offered a dictionary. Edits are a
// draft until applied, so a half-typed list never reaches a node: "Only" with
// the first chip not yet added would otherwise serve nobody for a moment.
export const ClientFilterField = ({
  value,
  disabled,
  onSave,
}: ClientFilterFieldProps) => {
  const [mode, setMode] = useState<ClientFilterMode>(value.mode)
  const [names, setNames] = useState<string[]>(value.clients.map(c => c.name))
  const [saving, setSaving] = useState(false)

  // The overview is polled, so follow what is stored whenever nothing is
  // being edited.
  const stored = JSON.stringify(value)
  const draft: ClientFilter = {
    mode,
    clients: mode === 'all' ? [] : names.map(name => ({ name })),
  }
  const dirty = !sameFilter(draft, value)
  useEffect(() => {
    if (saving) return
    setMode(value.mode)
    setNames(value.clients.map(c => c.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored])

  const changeMode = (next: ClientFilterMode) => {
    // A list means the opposite in the other mode, so it does not carry over.
    setMode(next)
    setNames([])
  }

  const apply = async () => {
    if (
      mode === 'only' &&
      names.length === 0 &&
      !window.confirm(
        'With no clients listed, no new connection gets a dictionary. Apply?'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setMode(value.mode)
    setNames(value.clients.map(c => c.name))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ minWidth: 64 }}>
          Serve to
        </Typography>
        <TextField
          select
          size="small"
          value={mode}
          disabled={disabled || saving}
          onChange={e => changeMode(e.target.value as ClientFilterMode)}
          sx={{ minWidth: 140 }}
          inputProps={{ 'aria-label': 'Serve to' }}
        >
          {MODES.map(m => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
        {mode !== 'all' && (
          <Autocomplete
            multiple
            freeSolo
            size="small"
            disabled={disabled || saving}
            options={[...SDK_NAMES, NO_NAME].filter(n => !names.includes(n))}
            getOptionLabel={nameLabel}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {option === NO_NAME ? <em>no name</em> : option}
              </li>
            )}
            value={names}
            onChange={(_, next) =>
              setNames(
                Array.from(
                  new Set(next.map(n => (n.trim() === '' ? NO_NAME : n.trim())))
                )
              )
            }
            renderTags={(tags, getTagProps) =>
              tags.map((name, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={name}
                  size="small"
                  label={name === NO_NAME ? <em>no name</em> : name}
                />
              ))
            }
            renderInput={params => (
              <TextField
                {...params}
                placeholder={names.length ? '' : 'Client name'}
                inputProps={{
                  ...params.inputProps,
                  'aria-label': 'Client names',
                }}
              />
            )}
            sx={{ flex: 1, minWidth: 220 }}
          />
        )}
        {dirty && (
          <>
            <Button
              size="small"
              variant="contained"
              disabled={disabled || saving}
              onClick={() => void apply()}
            >
              Apply
            </Button>
            <Button size="small" disabled={saving} onClick={reset}>
              Cancel
            </Button>
          </>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        The name a client sends on connect: official SDKs send their own (js,
        dart, …) unless the app sets another. A client's claim, not access
        control. Applies to new connections.
      </Typography>
    </Box>
  )
}
