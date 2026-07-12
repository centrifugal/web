import { useContext, useEffect, useState, useMemo, type JSX } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import {
  Autocomplete,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  MenuItem,
} from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'

import { useTheme } from '@mui/material/styles'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { Prec } from '@codemirror/state'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter } from '@codemirror/lint'

import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  a11yDark,
  solarizedLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { EmptyState } from 'components/EmptyState'

interface ActionsProps {
  signinSilent: () => void
  authorization: string
  edition: 'oss' | 'pro'
}

interface MethodOption {
  value: string
  name: string
  category: string
}

// Define method lists outside component to avoid recreation
const coreMethods: MethodOption[] = [
  { value: 'publish', name: 'Publish', category: 'OSS' },
  { value: 'broadcast', name: 'Broadcast', category: 'OSS' },
  { value: 'presence', name: 'Presence', category: 'OSS' },
  { value: 'presence_stats', name: 'Presence Stats', category: 'OSS' },
  { value: 'history', name: 'History', category: 'OSS' },
  { value: 'history_remove', name: 'History Remove', category: 'OSS' },
  { value: 'subscribe', name: 'Subscribe', category: 'OSS' },
  { value: 'unsubscribe', name: 'Unsubscribe', category: 'OSS' },
  { value: 'disconnect', name: 'Disconnect', category: 'OSS' },
  { value: 'info', name: 'Info', category: 'OSS' },
  { value: 'rpc', name: 'RPC', category: 'OSS' },
  { value: 'channels', name: 'Channels', category: 'OSS' },
  { value: 'map_publish', name: 'Map publish', category: 'OSS' },
  { value: 'map_remove', name: 'Map remove', category: 'OSS' },
  { value: 'map_read_state', name: 'Map read state', category: 'OSS' },
  { value: 'map_read_stream', name: 'Map read stream', category: 'OSS' },
  { value: 'map_stats', name: 'Map stats', category: 'OSS' },
  { value: 'map_clear', name: 'Map clear', category: 'OSS' },
  {
    value: 'shared_poll_publish',
    name: 'Shared poll publish',
    category: 'OSS',
  },
]

const proMethods: MethodOption[] = [
  { value: 'connections', name: 'Connections', category: 'PRO' },
  { value: 'update_user_status', name: 'Update user status', category: 'PRO' },
  { value: 'get_user_status', name: 'Get user status', category: 'PRO' },
  { value: 'delete_user_status', name: 'Delete user status', category: 'PRO' },
  { value: 'block_user', name: 'Block user', category: 'PRO' },
  { value: 'unblock_user', name: 'Unblock user', category: 'PRO' },
  { value: 'revoke_token', name: 'Revoke token', category: 'PRO' },
  {
    value: 'invalidate_user_tokens',
    name: 'Invalidate user tokens',
    category: 'PRO',
  },
  { value: 'device_register', name: 'Device register', category: 'PRO' },
  { value: 'device_update', name: 'Device update', category: 'PRO' },
  { value: 'device_remove', name: 'Device remove', category: 'PRO' },
  { value: 'device_list', name: 'Device list', category: 'PRO' },
  { value: 'device_topic_list', name: 'Device topic list', category: 'PRO' },
  {
    value: 'device_topic_update',
    name: 'Device topic update',
    category: 'PRO',
  },
  { value: 'user_topic_list', name: 'User topic list', category: 'PRO' },
  { value: 'user_topic_update', name: 'User topic update', category: 'PRO' },
  {
    value: 'send_push_notification',
    name: 'Send push notification',
    category: 'PRO',
  },
  { value: 'update_push_status', name: 'Update push status', category: 'PRO' },
  { value: 'cancel_push', name: 'Cancel push', category: 'PRO' },
]

export const Actions = ({
  signinSilent,
  authorization,
  edition,
}: ActionsProps) => {
  const { setTitle } = useContext(ShellContext)
  const { command, handleError } = useAdminApi({ authorization, signinSilent })
  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode

  const [method, setMethod] = useState<string>('publish')
  const [loading, setLoading] = useState<boolean>(false)
  const [request, setRequest] = useState<any | null>(null)
  const [response, setResponse] = useState<any | null>(null)
  const [executedAt, setExecutedAt] = useState<string | null>(null)
  const [responseKey, setResponseKey] = useState<number>(0)

  // Choose code style based on theme
  const codeStyle = useMemo(
    () => (colorMode === 'dark' ? a11yDark : solarizedLight),
    [colorMode]
  )

  // Combine method options, memoized on edition
  const methodOptions = useMemo<MethodOption[]>(
    () => (edition === 'pro' ? [...coreMethods, ...proMethods] : coreMethods),
    [edition]
  )

  // Send API request
  const sendRequest = async (params: any) => {
    setLoading(true)
    setRequest({ method, params })

    try {
      const data = await command(method, params)
      setResponse(data)
      setExecutedAt(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        })
      )
      setResponseKey(prev => prev + 1)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  // Handle method selection change
  const handleMethodChange = (_: any, option: MethodOption | null) => {
    setMethod(option?.value || 'publish')
    setRequest(null)
    setResponse(null)
    setExecutedAt(null)
    setResponseKey(0)
  }

  useEffect(() => {
    setTitle('Centrifugo | Actions')
  }, [setTitle])

  // Map of form components
  const formProps = { colorMode, loading, sendRequest, edition }
  const formMap: Record<string, JSX.Element> = {
    publish: <PublishForm {...formProps} />,
    broadcast: <BroadcastForm {...formProps} />,
    presence: <PresenceForm {...formProps} />,
    presence_stats: <PresenceStatsForm {...formProps} />,
    history: <HistoryForm {...formProps} />,
    history_remove: <HistoryRemoveForm {...formProps} />,
    subscribe: <SubscribeForm {...formProps} />,
    unsubscribe: <UnsubscribeForm {...formProps} />,
    disconnect: <DisconnectForm {...formProps} />,
    info: <InfoForm {...formProps} />,
    rpc: <RpcForm {...formProps} />,
    channels: <ChannelsForm {...formProps} />,
    connections: <ConnectionsForm {...formProps} />,
    update_user_status: <UpdateUserStatusForm {...formProps} />,
    get_user_status: <GetUserStatusForm {...formProps} />,
    delete_user_status: <DeleteUserStatusForm {...formProps} />,
    block_user: <BlockUserForm {...formProps} />,
    unblock_user: <UnblockUserForm {...formProps} />,
    revoke_token: <RevokeTokenForm {...formProps} />,
    invalidate_user_tokens: <InvalidateUserTokensForm {...formProps} />,
    map_publish: <MapPublishForm {...formProps} />,
    map_remove: <MapRemoveForm {...formProps} />,
    map_read_state: <MapReadStateForm {...formProps} />,
    map_read_stream: <MapReadStreamForm {...formProps} />,
    map_stats: <MapStatsForm {...formProps} />,
    map_clear: <MapClearForm {...formProps} />,
    shared_poll_publish: <SharedPollPublishForm {...formProps} />,
    device_register: <DeviceRegisterForm {...formProps} />,
    device_update: <DeviceUpdateForm {...formProps} />,
    device_remove: <DeviceRemoveForm {...formProps} />,
    device_list: <DeviceListForm {...formProps} />,
    device_topic_list: <DeviceTopicListForm {...formProps} />,
    device_topic_update: <DeviceTopicUpdateForm {...formProps} />,
    user_topic_list: <UserTopicListForm {...formProps} />,
    user_topic_update: <UserTopicUpdateForm {...formProps} />,
    send_push_notification: <SendPushNotificationForm {...formProps} />,
    update_push_status: <UpdatePushStatusForm {...formProps} />,
    cancel_push: <CancelPushForm {...formProps} />,
  }
  const FormElem = formMap[method] || null

  const copyToClipboard = (text: string) => () => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Execute server API command
      </Typography>
      <FormControl fullWidth>
        <Autocomplete
          value={
            methodOptions.find((opt: MethodOption) => opt.value === method) ||
            null
          }
          onChange={handleMethodChange}
          options={methodOptions}
          getOptionLabel={(opt: MethodOption) => opt.name}
          renderInput={params => (
            <TextField
              {...params}
              label="Method"
              variant="outlined"
              fullWidth
            />
          )}
        />
      </FormControl>
      {FormElem}
      {request && response ? (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid
            size={{
              xs: 12,
              md: 4,
            }}
          >
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6">Request</Typography>
                  <IconButton
                    size="small"
                    onClick={copyToClipboard(JSON.stringify(request, null, 2))}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />
                <SyntaxHighlighter language="json" style={codeStyle}>
                  {JSON.stringify(request, null, 2)}
                </SyntaxHighlighter>
              </CardContent>
            </Card>
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 8,
            }}
          >
            <Card
              key={responseKey}
              sx={{
                '@keyframes responseUpdate': {
                  '0%': {
                    backgroundColor:
                      colorMode === 'dark'
                        ? 'rgba(76, 175, 80, 0.1)'
                        : 'rgba(76, 175, 80, 0.05)',
                    transform: 'scale(1.01)',
                  },
                  '100%': {
                    backgroundColor: 'transparent',
                    transform: 'scale(1)',
                  },
                },
                animation:
                  responseKey > 0 ? 'responseUpdate 0.6s ease-out' : 'none',
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="h6">
                      Response{' '}
                      {!response.error ? (
                        <Box component="span" sx={{ color: 'success.main' }}>
                          OK
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: 'error.main' }}>
                          ERROR
                        </Box>
                      )}
                    </Typography>
                    {executedAt && (
                      <Typography variant="caption" color="text.secondary">
                        Executed at {executedAt}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={copyToClipboard(
                      JSON.stringify(
                        !response.error ? response.result : response.error,
                        null,
                        2
                      )
                    )}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />
                <SyntaxHighlighter language="json" style={codeStyle}>
                  {!response.error
                    ? JSON.stringify(response.result, null, 2)
                    : JSON.stringify(response.error, null, 2)}
                </SyntaxHighlighter>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <EmptyState
          icon={<LocalFireDepartmentIcon sx={{ fontSize: 40 }} />}
          title="No request sent yet"
          hint="Pick a method above, fill in the form and submit — the request and response will appear here."
        />
      )}
    </Box>
  )
}

interface SubmitButtonProps {
  loading: boolean
  text: string
}

export const SubmitButton = ({ loading, text }: SubmitButtonProps) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
      <Box sx={{ position: 'relative' }}>
        <Button
          type="submit"
          variant="solid"
          color="primary"
          disabled={loading}
        >
          {text}
        </Button>
        {loading && (
          <CircularProgress
            size={24}
            sx={{
              color: 'primary.main',
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px',
            }}
          />
        )}
      </Box>
    </Box>
  )
}

interface JsonFieldProps {
  colorMode: 'light' | 'dark'
  onChange: (value: string, event?: any) => void
}

export const JsonField = ({ colorMode, onChange }: JsonFieldProps) => {
  const theme = useTheme()
  // The MUI outlined inputs on this page are transparent, so they render the
  // page surface color (background.default, set on <body> by CssBaseline). Match
  // it explicitly here so the editor's fill is identical to the other inputs in
  // both light and dark modes, instead of the built-in dark theme's bluish grey.
  const fieldBackground = theme.palette.background.default
  return (
    <Box
      sx={{
        border: `1px solid ${
          colorMode === 'dark'
            ? 'rgba(255, 255, 255, 0.23)'
            : 'rgba(0, 0, 0, 0.23)'
        }`,
        borderRadius: '4px',
        overflow: 'hidden',
        transition: 'border-color .15s',
        // The inner CodeMirror suppresses its own focus outline; light up this
        // wrapper's border instead, matching the outlined inputs' focus.
        '&:focus-within': { borderColor: 'primary.main' },
      }}
    >
      <CodeMirror
        theme={colorMode}
        height="250px"
        width="100%"
        extensions={[
          json(),
          // Inline JSON validation (parity with the previous editor's validate: true),
          // no remote JSON schema fetching involved.
          linter(jsonParseLinter()),
          EditorView.lineWrapping,
          // Keep the theme's syntax colors, but force the editor surfaces to the
          // same background as the surrounding MUI inputs. Prec.highest ensures
          // this wins over the built-in theme's own background rules.
          Prec.highest(
            EditorView.theme({
              '&': { fontSize: '16px', backgroundColor: fieldBackground },
              '.cm-gutters': { backgroundColor: fieldBackground },
              '.cm-scroller': { backgroundColor: fieldBackground },
              '&.cm-focused': { outline: 'none' },
            })
          ),
        ]}
        onChange={value => onChange(value || '')}
        basicSetup={{
          // No line numbers / folding — keeps it a compact payload field.
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          // No autocomplete noise (this is what the `$schema` suggestion used to be).
          autocompletion: false,
        }}
      />
    </Box>
  )
}

interface FormProps {
  colorMode: 'light' | 'dark'
  loading: boolean
  sendRequest: (req: any) => void
  // Edition gates PRO-only fields (label_filter, all_users) inside otherwise-OSS forms.
  edition: 'oss' | 'pro'
}

interface KeyValuePair {
  key: string
  value: string
}

// Split a space-separated input ("id1 id2  id3") into a trimmed, non-empty list.
const splitList = (s: string): string[] =>
  s
    .split(' ')
    .map(x => x.trim())
    .filter(Boolean)

// Convert KeyValueInput pairs to a string map, keeping only entries with a non-empty key.
// Returns undefined when nothing is set so callers can omit the field entirely.
const pairsToMap = (
  pairs: KeyValuePair[]
): Record<string, string> | undefined => {
  const map: Record<string, string> = {}
  let has = false
  for (const p of pairs) {
    const k = p.key.trim()
    if (k) {
      map[k] = p.value
      has = true
    }
  }
  return has ? map : undefined
}

interface KeyValueInputProps {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
}

export const KeyValueInput = ({ pairs, onChange }: KeyValueInputProps) => {
  const addPair = () => {
    onChange([...pairs, { key: '', value: '' }])
  }

  const removePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index))
  }

  const updatePair = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...pairs]
    updated[index][field] = value
    onChange(updated)
  }

  return (
    <Box sx={{ mt: 1 }}>
      {pairs.map((pair, index) => (
        <Grid container spacing={1} key={index} sx={{ mb: 1 }}>
          <Grid size={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Tag key"
              value={pair.key}
              onChange={e => updatePair(index, 'key', e.target.value)}
            />
          </Grid>
          <Grid size={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Tag value"
              value={pair.value}
              onChange={e => updatePair(index, 'value', e.target.value)}
            />
          </Grid>
          <Grid size={2} sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => removePair(index)}
              disabled={pairs.length === 1}
              title="Delete"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            {index === pairs.length - 1 && (
              <IconButton size="small" onClick={addPair} title="Add tag">
                <AddIcon fontSize="small" />
              </IconButton>
            )}
          </Grid>
        </Grid>
      ))}
    </Box>
  )
}

// PRO label_filter (FilterNode) builder. A FilterNode is either a leaf ({key, cmp, val|vals}) or a
// branch ({op: and|or, nodes:[...]}). This input models a two-level filter: an outer AND/OR that
// combines *groups*, and each group is its own AND/OR of leaf conditions and can be negated (NOT).
// That covers expressions like (C1 AND C2) OR NOT(C3 AND C4). Deeper nesting isn't exposed.
// Comparison ops mirror the server (internal/tools/filter_node_pro.go).
interface LabelCondition {
  key: string
  cmp: string
  value: string
}
interface LabelGroup {
  combinator: 'and' | 'or'
  // Negate the whole group → wraps its node in a NOT (which must have exactly one child).
  negate: boolean
  conditions: LabelCondition[]
}
interface LabelFilter {
  combinator: 'and' | 'or'
  groups: LabelGroup[]
}

const emptyCondition = (): LabelCondition => ({ key: '', cmp: 'eq', value: '' })
const emptyGroup = (): LabelGroup => ({
  combinator: 'and',
  negate: false,
  conditions: [emptyCondition()],
})
const emptyLabelFilter = (): LabelFilter => ({
  combinator: 'and',
  groups: [emptyGroup()],
})

const LABEL_CMP_OPTIONS: { value: string; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'in', label: 'in list' },
  { value: 'nin', label: 'not in list' },
  { value: 'ex', label: 'exists' },
  { value: 'nex', label: 'not exists' },
  { value: 'sw', label: 'starts with' },
  { value: 'ew', label: 'ends with' },
  { value: 'ct', label: 'contains' },
  { value: 'gt', label: '> (numeric)' },
  { value: 'gte', label: '≥ (numeric)' },
  { value: 'lt', label: '< (numeric)' },
  { value: 'lte', label: '≤ (numeric)' },
]
const LABEL_CMP_NO_VALUE = new Set(['ex', 'nex'])
const LABEL_CMP_LIST = new Set(['in', 'nin'])

// Build a FilterNode from the filter, or undefined when nothing usable is set. A lone leaf/group
// collapses to a bare node (no needless single-child branch); otherwise it wraps in an and/or.
const buildLabelFilter = (filter: LabelFilter): any | undefined => {
  const toLeaf = (c: LabelCondition): any => {
    const node: any = { key: c.key.trim(), cmp: c.cmp }
    if (LABEL_CMP_LIST.has(c.cmp)) node.vals = splitList(c.value)
    else if (!LABEL_CMP_NO_VALUE.has(c.cmp)) node.val = c.value
    return node
  }
  const groupNodes = filter.groups
    .map(g => {
      const leaves = g.conditions.filter(c => c.key.trim() && c.cmp).map(toLeaf)
      if (leaves.length === 0) return null
      const base =
        leaves.length === 1 ? leaves[0] : { op: g.combinator, nodes: leaves }
      return g.negate ? { op: 'not', nodes: [base] } : base
    })
    .filter(Boolean)
  if (groupNodes.length === 0) return undefined
  if (groupNodes.length === 1) return groupNodes[0]
  return { op: filter.combinator, nodes: groupNodes }
}

interface LabelFilterInputProps {
  value: LabelFilter
  onChange: (v: LabelFilter) => void
}

export const LabelFilterInput = ({
  value,
  onChange,
}: LabelFilterInputProps) => {
  const patchGroup = (gi: number, patch: Partial<LabelGroup>) =>
    onChange({
      ...value,
      groups: value.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
    })
  const patchCondition = (
    gi: number,
    ci: number,
    patch: Partial<LabelCondition>
  ) =>
    patchGroup(gi, {
      conditions: value.groups[gi].conditions.map((c, i) =>
        i === ci ? { ...c, ...patch } : c
      ),
    })
  const addCondition = (gi: number) =>
    patchGroup(gi, {
      conditions: [...value.groups[gi].conditions, emptyCondition()],
    })
  const removeCondition = (gi: number, ci: number) =>
    patchGroup(gi, {
      conditions: value.groups[gi].conditions.filter((_, i) => i !== ci),
    })
  const addGroup = () =>
    onChange({ ...value, groups: [...value.groups, emptyGroup()] })
  const removeGroup = (gi: number) =>
    onChange({ ...value, groups: value.groups.filter((_, i) => i !== gi) })

  const multiGroup = value.groups.length > 1

  return (
    <Box sx={{ mt: 1 }}>
      {multiGroup && (
        <TextField
          select
          size="small"
          label="Combine groups"
          value={value.combinator}
          onChange={e =>
            onChange({ ...value, combinator: e.target.value as 'and' | 'or' })
          }
          sx={{ mb: 1, minWidth: 200 }}
        >
          <MenuItem value="and">Match ALL groups (AND)</MenuItem>
          <MenuItem value="or">Match ANY group (OR)</MenuItem>
        </TextField>
      )}
      {value.groups.map((group, gi) => {
        const multiCond = group.conditions.length > 1
        return (
          <Box
            key={gi}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              mb: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Group {gi + 1}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={group.negate}
                    onChange={e => patchGroup(gi, { negate: e.target.checked })}
                  />
                }
                label="NOT"
                sx={{ mr: 0 }}
              />
              {multiCond && (
                <TextField
                  select
                  size="small"
                  value={group.combinator}
                  onChange={e =>
                    patchGroup(gi, {
                      combinator: e.target.value as 'and' | 'or',
                    })
                  }
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="and">All (AND)</MenuItem>
                  <MenuItem value="or">Any (OR)</MenuItem>
                </TextField>
              )}
              <Box sx={{ flexGrow: 1 }} />
              {multiGroup && (
                <IconButton
                  size="small"
                  onClick={() => removeGroup(gi)}
                  title="Delete group"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            {group.conditions.map((cond, ci) => {
              const noValue = LABEL_CMP_NO_VALUE.has(cond.cmp)
              const isList = LABEL_CMP_LIST.has(cond.cmp)
              return (
                <Grid container spacing={1} key={ci} sx={{ mb: 1 }}>
                  <Grid size={4}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Label key"
                      value={cond.key}
                      onChange={e =>
                        patchCondition(gi, ci, { key: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid size={3}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={cond.cmp}
                      onChange={e =>
                        patchCondition(gi, ci, { cmp: e.target.value })
                      }
                    >
                      {LABEL_CMP_OPTIONS.map(o => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={3}>
                    <TextField
                      fullWidth
                      size="small"
                      disabled={noValue}
                      placeholder={
                        noValue ? '—' : isList ? 'Values (space-sep)' : 'Value'
                      }
                      value={cond.value}
                      onChange={e =>
                        patchCondition(gi, ci, { value: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid size={2} sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => removeCondition(gi, ci)}
                      disabled={!multiCond}
                      title="Delete condition"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    {ci === group.conditions.length - 1 && (
                      <IconButton
                        size="small"
                        onClick={() => addCondition(gi)}
                        title="Add condition"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Grid>
                </Grid>
              )
            })}
          </Box>
        )
      })}
      <Button
        variant="tonal"
        color="inherit"
        size="small"
        startIcon={<AddIcon />}
        onClick={addGroup}
      >
        Add group
      </Button>
    </Box>
  )
}

// PRO-only targeting shared by Unsubscribe/Disconnect: an "all users" toggle plus the client
// label filter. Rendered only when edition === 'pro'.
interface ProLabelTargetingProps {
  allUsers: boolean
  onAllUsers: (b: boolean) => void
  filter: LabelFilter
  onFilter: (f: LabelFilter) => void
}

const ProLabelTargeting = (p: ProLabelTargetingProps) => (
  <>
    <Divider sx={{ my: 2 }}>
      <Typography variant="caption" color="text.secondary">
        PRO
      </Typography>
    </Divider>
    <FormGroup>
      <FormControlLabel
        control={
          <Checkbox
            checked={p.allUsers}
            onChange={e => p.onAllUsers(e.target.checked)}
          />
        }
        label="All users — when User ID is empty, target every connection instead of only anonymous ones"
      />
    </FormGroup>
    <Typography variant="caption" color="text.secondary">
      Client label filter
    </Typography>
    <LabelFilterInput value={p.filter} onChange={p.onFilter} />
  </>
)

export const PublishForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [version, setVersion] = useState('')
  const [versionEpoch, setVersionEpoch] = useState('')
  const [delta, setDelta] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [tags, setTags] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }

    const params: any = { channel: channel, data: jsonData }

    if (idempotencyKey.trim()) params.idempotency_key = idempotencyKey.trim()
    if (version.trim()) params.version = parseInt(version)
    if (versionEpoch.trim()) params.version_epoch = versionEpoch.trim()
    if (delta) params.delta = true

    const tagsMap = pairsToMap(tags)
    if (tagsMap) params.tags = tagsMap

    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Channel"
            autoComplete="off"
            onChange={e => setChannel(e.target.value)}
            value={channel}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Idempotency Key"
            autoComplete="off"
            onChange={e => setIdempotencyKey(e.target.value)}
            value={idempotencyKey}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            margin="none"
            fullWidth
            label="Version"
            type="number"
            autoComplete="off"
            onChange={e => setVersion(e.target.value)}
            value={version}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            margin="none"
            fullWidth
            label="Version epoch"
            autoComplete="off"
            onChange={e => setVersionEpoch(e.target.value)}
            value={versionEpoch}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={delta}
                onChange={e => setDelta(e.target.checked)}
              />
            }
            label="Delta"
          />
        </Grid>
      </Grid>
      <KeyValueInput pairs={tags} onChange={setTags} />
      <Box sx={{ mt: 2 }}>
        <JsonField colorMode={colorMode} onChange={setData} />
      </Box>
      <SubmitButton loading={loading} text="Publish" />
    </Box>
  )
}

export const BroadcastForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [version, setVersion] = useState('')
  const [versionEpoch, setVersionEpoch] = useState('')
  const [delta, setDelta] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [tags, setTags] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }

    const params: any = { channels: splitList(channel), data: jsonData }

    if (idempotencyKey.trim()) params.idempotency_key = idempotencyKey.trim()
    if (version.trim()) params.version = parseInt(version)
    if (versionEpoch.trim()) params.version_epoch = versionEpoch.trim()
    if (delta) params.delta = true

    const tagsMap = pairsToMap(tags)
    if (tagsMap) params.tags = tagsMap

    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channels (SPACE-separated)"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="none"
            fullWidth
            label="Idempotency Key"
            autoComplete="off"
            onChange={e => setIdempotencyKey(e.target.value)}
            value={idempotencyKey}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            margin="none"
            fullWidth
            label="Version"
            type="number"
            autoComplete="off"
            onChange={e => setVersion(e.target.value)}
            value={version}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            margin="none"
            fullWidth
            label="Version epoch"
            autoComplete="off"
            onChange={e => setVersionEpoch(e.target.value)}
            value={versionEpoch}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={delta}
                onChange={e => setDelta(e.target.checked)}
              />
            }
            label="Delta"
          />
        </Grid>
      </Grid>
      <KeyValueInput pairs={tags} onChange={setTags} />
      <Box sx={{ mt: 2 }}>
        <JsonField colorMode={colorMode} onChange={setData} />
      </Box>
      <SubmitButton loading={loading} text="Broadcast" />
    </Box>
  )
}

export const PresenceForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Presence" />
    </Box>
  )
}

export const PresenceStatsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Presence Stats" />
    </Box>
  )
}

export const HistoryForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const [channel, setChannel] = useState('')
  const [limit, setLimit] = useState(0)
  const [offset, setOffset] = useState<number | null>(null)
  const [epoch, setEpoch] = useState<string>('')
  const [reverse, setReverse] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel: channel, limit: limit, reverse: reverse }
    if (offset !== null) {
      params.since = { offset: offset, epoch: epoch }
    }
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        fullWidth
        required
        name="limit"
        label="Limit"
        type="number"
        id="text"
        autoComplete="off"
        onChange={event => setLimit(parseInt(event.target.value))}
        value={limit}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            name="offset"
            label="Since offset"
            type="number"
            id="text"
            autoComplete="off"
            onChange={event => {
              if (event.target.value === '') {
                setOffset(null)
              } else {
                setOffset(parseInt(event.target.value))
              }
            }}
            value={offset}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            name="epoch"
            label="Since epoch"
            type="text"
            id="text"
            autoComplete="off"
            onChange={event => setEpoch(event.target.value)}
            value={epoch}
          />
        </Grid>
      </Grid>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox onChange={event => setReverse(event.target.checked)} />
          }
          label="Reverse"
          checked={reverse}
        />
      </FormGroup>
      <SubmitButton loading={loading} text="History" />
    </Box>
  )
}

export const HistoryRemoveForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="History Remove" />
    </Box>
  )
}

export const SubscribeForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel: channel, user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="channel"
        label="Channel"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setChannel(event.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Subscribe" />
    </Box>
  )
}

export const UnsubscribeForm = ({
  loading,
  sendRequest,
  edition,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [client, setClient] = useState('')
  const [session, setSession] = useState('')
  const [allUsers, setAllUsers] = useState(false)
  const [filter, setFilter] = useState<LabelFilter>(emptyLabelFilter)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel }
    if (user.trim()) params.user = user.trim()
    if (client.trim()) params.client = client.trim()
    if (session.trim()) params.session = session.trim()
    if (edition === 'pro') {
      if (allUsers) params.all_users = true
      const lf = buildLabelFilter(filter)
      if (lf) params.label_filter = lf
    }
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="User ID"
            autoComplete="off"
            onChange={e => setUser(e.target.value)}
            value={user}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Client ID"
            autoComplete="off"
            onChange={e => setClient(e.target.value)}
            value={client}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Session ID"
            autoComplete="off"
            onChange={e => setSession(e.target.value)}
            value={session}
          />
        </Grid>
      </Grid>
      {edition === 'pro' && (
        <ProLabelTargeting
          allUsers={allUsers}
          onAllUsers={setAllUsers}
          filter={filter}
          onFilter={setFilter}
        />
      )}
      <SubmitButton loading={loading} text="Unsubscribe" />
    </Box>
  )
}

export const DisconnectForm = ({
  loading,
  sendRequest,
  edition,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [client, setClient] = useState('')
  const [session, setSession] = useState('')
  const [whitelist, setWhitelist] = useState('')
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')
  const [allUsers, setAllUsers] = useState(false)
  const [filter, setFilter] = useState<LabelFilter>(emptyLabelFilter)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = {}
    if (user.trim()) params.user = user.trim()
    if (client.trim()) params.client = client.trim()
    if (session.trim()) params.session = session.trim()
    if (whitelist.trim()) params.whitelist = splitList(whitelist)
    if (code.trim() || reason.trim()) {
      const d: any = {}
      if (code.trim()) d.code = parseInt(code)
      if (reason.trim()) d.reason = reason.trim()
      params.disconnect = d
    }
    if (edition === 'pro') {
      if (allUsers) params.all_users = true
      const lf = buildLabelFilter(filter)
      if (lf) params.label_filter = lf
    }
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="User ID"
            autoComplete="off"
            onChange={e => setUser(e.target.value)}
            value={user}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Client ID"
            autoComplete="off"
            onChange={e => setClient(e.target.value)}
            value={client}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Session ID"
            autoComplete="off"
            onChange={e => setSession(e.target.value)}
            value={session}
          />
        </Grid>
      </Grid>
      <TextField
        margin="normal"
        fullWidth
        label="Whitelist (client IDs, space-separated)"
        autoComplete="off"
        helperText="These client IDs are kept connected"
        onChange={e => setWhitelist(e.target.value)}
        value={whitelist}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 4, sm: 3 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Code"
            type="number"
            autoComplete="off"
            helperText="Disconnect code"
            onChange={e => setCode(e.target.value)}
            value={code}
          />
        </Grid>
        <Grid size={{ xs: 8, sm: 9 }}>
          <TextField
            margin="normal"
            fullWidth
            label="Reason"
            autoComplete="off"
            helperText="Disconnect reason"
            onChange={e => setReason(e.target.value)}
            value={reason}
          />
        </Grid>
      </Grid>
      {edition === 'pro' && (
        <ProLabelTargeting
          allUsers={allUsers}
          onAllUsers={setAllUsers}
          filter={filter}
          onFilter={setFilter}
        />
      )}
      <SubmitButton loading={loading} text="Disconnect" />
    </Box>
  )
}

export const InfoForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({})
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <SubmitButton loading={loading} text="Info" />
    </Box>
  )
}

export const ChannelsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [pattern, setPattern] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ pattern: pattern })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        name="pattern"
        label="Pattern"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setPattern(event.target.value)}
        value={pattern}
      />
      <SubmitButton loading={loading} text="Channels" />
    </Box>
  )
}

export const RpcForm = ({ colorMode, loading, sendRequest }: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [method, setMethod] = useState('')
  const [data, setData] = useState<any | null>(null)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    let jsonData
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    sendRequest({ method: method, data: jsonData })
  }

  const onDataChange = (newValue: any) => {
    setData(newValue)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="method"
        label="Method"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setMethod(event.target.value)}
        value={method}
      />
      <JsonField colorMode={colorMode} onChange={onDataChange} />
      <SubmitButton loading={loading} text="RPC" />
    </Box>
  )
}

export const ConnectionsForm = ({
  loading,
  sendRequest,
  edition,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [expression, setExpression] = useState('')
  const [filter, setFilter] = useState<LabelFilter>(emptyLabelFilter)
  const { showAlert } = useContext(ShellContext)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const lf = edition === 'pro' ? buildLabelFilter(filter) : undefined
    if (!user && !expression && !lf) {
      showAlert('User, CEL expression, or label filter required', {
        severity: 'error',
      })
      return
    }
    const params: any = { user: user, expression: expression }
    if (lf) params.label_filter = lf
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        fullWidth
        name="expression"
        label="CEL expression"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setExpression(event.target.value)}
        value={expression}
      />
      {edition === 'pro' && (
        <>
          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              PRO
            </Typography>
          </Divider>
          <Typography variant="caption" color="text.secondary">
            Client label filter
          </Typography>
          <LabelFilterInput value={filter} onChange={setFilter} />
        </>
      )}
      <SubmitButton loading={loading} text="Connections" />
    </Box>
  )
}

export const UpdateUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Update user status" />
    </Box>
  )
}

export const GetUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Get user status" />
    </Box>
  )
}

export const DeleteUserStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ users: user.split(' ') })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User IDs"
        type="text"
        id="text"
        autoComplete="off"
        helperText="Space-separated list of User IDs"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Delete user status" />
    </Box>
  )
}

export const BlockUserForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [exp, setExp] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user, expire_at: exp })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Block user" />
    </Box>
  )
}

export const UnblockUserForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Unblock user" />
    </Box>
  )
}

export const InvalidateUserTokensForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [exp, setExp] = useState(0)
  const [before, setBefore] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user: user, expire_at: exp, issued_before: before })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="user"
        label="User ID"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUser(event.target.value)}
        value={user}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="before"
        label="Tokens issued before"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value tells server to use current time"
        onChange={event => setBefore(parseInt(event.target.value))}
        value={before}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Invalidate user tokens" />
    </Box>
  )
}

export const RevokeTokenForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [uid, setUid] = useState('')
  const [exp, setExp] = useState(0)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ uid: uid, expire_at: exp })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        name="uid"
        label="Token uid (jti)"
        type="text"
        id="text"
        autoComplete="off"
        onChange={event => setUid(event.target.value)}
        value={uid}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="exp"
        label="Expire at"
        type="number"
        id="text"
        autoComplete="off"
        helperText="Unix seconds, zero value means no expiration and not recommended"
        onChange={event => setExp(parseInt(event.target.value))}
        value={exp}
      />
      <SubmitButton loading={loading} text="Revoke token" />
    </Box>
  )
}

export const MapPublishForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [key, setKey] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [version, setVersion] = useState('')
  const [versionEpoch, setVersionEpoch] = useState('')
  const [keyMode, setKeyMode] = useState('')
  const [delta, setDelta] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [tags, setTags] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    const params: any = { channel, key, data: jsonData }
    if (idempotencyKey.trim()) params.idempotency_key = idempotencyKey.trim()
    if (version.trim()) params.version = parseInt(version)
    if (versionEpoch.trim()) params.version_epoch = versionEpoch.trim()
    if (keyMode.trim()) params.key_mode = keyMode.trim()
    if (delta) params.delta = true
    const tagsMap = pairsToMap(tags)
    if (tagsMap) params.tags = tagsMap
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        label="Key"
        autoComplete="off"
        onChange={e => setKey(e.target.value)}
        value={key}
      />
      <TextField
        margin="normal"
        fullWidth
        label="Idempotency Key"
        autoComplete="off"
        onChange={e => setIdempotencyKey(e.target.value)}
        value={idempotencyKey}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Version"
            type="number"
            autoComplete="off"
            onChange={e => setVersion(e.target.value)}
            value={version}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Version epoch"
            autoComplete="off"
            onChange={e => setVersionEpoch(e.target.value)}
            value={versionEpoch}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Key mode"
            autoComplete="off"
            onChange={e => setKeyMode(e.target.value)}
            value={keyMode}
          />
        </Grid>
      </Grid>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={delta}
              onChange={e => setDelta(e.target.checked)}
            />
          }
          label="Delta"
        />
      </FormGroup>
      <KeyValueInput pairs={tags} onChange={setTags} />
      <Box sx={{ mt: 2 }}>
        <JsonField colorMode={colorMode} onChange={setData} />
      </Box>
      <SubmitButton loading={loading} text="Map publish" />
    </Box>
  )
}

export const MapRemoveForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [key, setKey] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel, key }
    if (idempotencyKey.trim()) params.idempotency_key = idempotencyKey.trim()
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        label="Key"
        autoComplete="off"
        onChange={e => setKey(e.target.value)}
        value={key}
      />
      <TextField
        margin="normal"
        fullWidth
        label="Idempotency Key"
        autoComplete="off"
        onChange={e => setIdempotencyKey(e.target.value)}
        value={idempotencyKey}
      />
      <SubmitButton loading={loading} text="Map remove" />
    </Box>
  )
}

export const MapReadStateForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [key, setKey] = useState('')
  const [cursor, setCursor] = useState('')
  const [limit, setLimit] = useState('')
  const [revisionOffset, setRevisionOffset] = useState('')
  const [revisionEpoch, setRevisionEpoch] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel }
    if (key.trim()) params.key = key.trim()
    if (cursor.trim()) params.cursor = cursor.trim()
    if (limit.trim()) params.limit = parseInt(limit)
    if (revisionOffset.trim()) params.revision_offset = parseInt(revisionOffset)
    if (revisionEpoch.trim()) params.revision_epoch = revisionEpoch.trim()
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        fullWidth
        label="Key"
        autoComplete="off"
        helperText="Read a single key; leave empty to page over all keys"
        onChange={e => setKey(e.target.value)}
        value={key}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Cursor"
            autoComplete="off"
            onChange={e => setCursor(e.target.value)}
            value={cursor}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Limit"
            type="number"
            autoComplete="off"
            onChange={e => setLimit(e.target.value)}
            value={limit}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Revision offset"
            type="number"
            autoComplete="off"
            onChange={e => setRevisionOffset(e.target.value)}
            value={revisionOffset}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Revision epoch"
            autoComplete="off"
            onChange={e => setRevisionEpoch(e.target.value)}
            value={revisionEpoch}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="Map read state" />
    </Box>
  )
}

export const MapReadStreamForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')
  const [sinceOffset, setSinceOffset] = useState('')
  const [sinceEpoch, setSinceEpoch] = useState('')
  const [limit, setLimit] = useState('')
  const [reverse, setReverse] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { channel }
    if (sinceOffset.trim()) params.since_offset = parseInt(sinceOffset)
    if (sinceEpoch.trim()) params.since_epoch = sinceEpoch.trim()
    if (limit.trim()) params.limit = parseInt(limit)
    if (reverse) params.reverse = true
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Since offset"
            type="number"
            autoComplete="off"
            onChange={e => setSinceOffset(e.target.value)}
            value={sinceOffset}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Since epoch"
            autoComplete="off"
            onChange={e => setSinceEpoch(e.target.value)}
            value={sinceEpoch}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Limit"
            type="number"
            autoComplete="off"
            onChange={e => setLimit(e.target.value)}
            value={limit}
          />
        </Grid>
      </Grid>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={reverse}
              onChange={e => setReverse(e.target.checked)}
            />
          }
          label="Reverse"
        />
      </FormGroup>
      <SubmitButton loading={loading} text="Map read stream" />
    </Box>
  )
}

export const MapStatsForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Map stats" />
    </Box>
  )
}

export const MapClearForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [channel, setChannel] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ channel })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <SubmitButton loading={loading} text="Map clear" />
    </Box>
  )
}

export const SharedPollPublishForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [channel, setChannel] = useState('')
  const [key, setKey] = useState('')
  const [version, setVersion] = useState('')
  const [epoch, setEpoch] = useState('')
  const [data, setData] = useState<any | null>(null)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) {
      showAlert('Data required', { severity: 'error' })
      return
    }
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch {
      showAlert('Invalid JSON data', { severity: 'error' })
      return
    }
    const params: any = { channel, key, data: jsonData }
    if (version.trim()) params.version = parseInt(version)
    if (epoch.trim()) params.epoch = epoch.trim()
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Channel"
        autoComplete="off"
        onChange={e => setChannel(e.target.value)}
        value={channel}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        label="Key"
        autoComplete="off"
        onChange={e => setKey(e.target.value)}
        value={key}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Version"
            type="number"
            autoComplete="off"
            onChange={e => setVersion(e.target.value)}
            value={version}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Epoch"
            autoComplete="off"
            onChange={e => setEpoch(e.target.value)}
            value={epoch}
          />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2 }}>
        <JsonField colorMode={colorMode} onChange={setData} />
      </Box>
      <SubmitButton loading={loading} text="Shared poll publish" />
    </Box>
  )
}

export const DeviceRegisterForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [id, setId] = useState('')
  const [provider, setProvider] = useState('')
  const [token, setToken] = useState('')
  const [platform, setPlatform] = useState('')
  const [user, setUser] = useState('')
  const [timezone, setTimezone] = useState('')
  const [locale, setLocale] = useState('')
  const [topics, setTopics] = useState('')
  const [meta, setMeta] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { provider, token }
    if (id.trim()) params.id = id.trim()
    if (platform.trim()) params.platform = platform.trim()
    if (user.trim()) params.user = user.trim()
    if (timezone.trim()) params.timezone = timezone.trim()
    if (locale.trim()) params.locale = locale.trim()
    if (topics.trim()) params.topics = splitList(topics)
    const metaMap = pairsToMap(meta)
    if (metaMap) params.meta = metaMap
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        label="Device ID"
        autoComplete="off"
        helperText="Leave empty to let Centrifugo generate an ID"
        onChange={e => setId(e.target.value)}
        value={id}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        label="Provider"
        autoComplete="off"
        helperText="fcm | hms | apns"
        onChange={e => setProvider(e.target.value)}
        value={provider}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        label="Token"
        autoComplete="off"
        onChange={e => setToken(e.target.value)}
        value={token}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Platform"
            autoComplete="off"
            onChange={e => setPlatform(e.target.value)}
            value={platform}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="User"
            autoComplete="off"
            onChange={e => setUser(e.target.value)}
            value={user}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Timezone"
            autoComplete="off"
            onChange={e => setTimezone(e.target.value)}
            value={timezone}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Locale"
            autoComplete="off"
            onChange={e => setLocale(e.target.value)}
            value={locale}
          />
        </Grid>
      </Grid>
      <TextField
        margin="normal"
        fullWidth
        label="Topics"
        autoComplete="off"
        helperText="Space-separated list of topics"
        onChange={e => setTopics(e.target.value)}
        value={topics}
      />
      <Typography variant="caption" color="text.secondary">
        Meta
      </Typography>
      <KeyValueInput pairs={meta} onChange={setMeta} />
      <SubmitButton loading={loading} text="Device register" />
    </Box>
  )
}

export const DeviceUpdateForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [ids, setIds] = useState('')
  const [users, setUsers] = useState('')
  const [userUpdate, setUserUpdate] = useState('')
  const [timezoneUpdate, setTimezoneUpdate] = useState('')
  const [localeUpdate, setLocaleUpdate] = useState('')
  const [topicsOp, setTopicsOp] = useState('add')
  const [topics, setTopics] = useState('')
  const [meta, setMeta] = useState<KeyValuePair[]>([{ key: '', value: '' }])

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ids.trim() && !users.trim()) {
      showAlert('Device IDs or Users required', { severity: 'error' })
      return
    }
    const params: any = {}
    if (ids.trim()) params.ids = splitList(ids)
    if (users.trim()) params.users = splitList(users)
    if (userUpdate.trim()) params.user_update = { user: userUpdate.trim() }
    if (timezoneUpdate.trim())
      params.timezone_update = { timezone: timezoneUpdate.trim() }
    if (localeUpdate.trim())
      params.locale_update = { locale: localeUpdate.trim() }
    if (topics.trim())
      params.topics_update = { op: topicsOp, topics: splitList(topics) }
    const metaMap = pairsToMap(meta)
    if (metaMap) params.meta_update = { meta: metaMap }
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        label="Device IDs"
        autoComplete="off"
        helperText="Space-separated; select devices to update by id"
        onChange={e => setIds(e.target.value)}
        value={ids}
      />
      <TextField
        margin="normal"
        fullWidth
        label="Users"
        autoComplete="off"
        helperText="Space-separated; or select devices by owning user"
        onChange={e => setUsers(e.target.value)}
        value={users}
      />
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary">
        Only the updates you fill in are applied.
      </Typography>
      <TextField
        margin="normal"
        fullWidth
        label="Set user"
        autoComplete="off"
        onChange={e => setUserUpdate(e.target.value)}
        value={userUpdate}
      />
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Set timezone"
            autoComplete="off"
            onChange={e => setTimezoneUpdate(e.target.value)}
            value={timezoneUpdate}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Set locale"
            autoComplete="off"
            onChange={e => setLocaleUpdate(e.target.value)}
            value={localeUpdate}
          />
        </Grid>
        <Grid size={4}>
          <TextField
            select
            margin="normal"
            fullWidth
            label="Topics op"
            value={topicsOp}
            onChange={e => setTopicsOp(e.target.value)}
          >
            <MenuItem value="add">add</MenuItem>
            <MenuItem value="remove">remove</MenuItem>
            <MenuItem value="set">set</MenuItem>
          </TextField>
        </Grid>
        <Grid size={8}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            helperText="Space-separated"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary">
        Set meta
      </Typography>
      <KeyValueInput pairs={meta} onChange={setMeta} />
      <SubmitButton loading={loading} text="Device update" />
    </Box>
  )
}

export const DeviceRemoveForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [ids, setIds] = useState('')
  const [users, setUsers] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ids.trim() && !users.trim()) {
      showAlert('Device IDs or Users required', { severity: 'error' })
      return
    }
    const params: any = {}
    if (ids.trim()) params.ids = splitList(ids)
    if (users.trim()) params.users = splitList(users)
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        fullWidth
        label="Device IDs"
        autoComplete="off"
        helperText="Space-separated list of device ids"
        onChange={e => setIds(e.target.value)}
        value={ids}
      />
      <TextField
        margin="normal"
        fullWidth
        label="Users"
        autoComplete="off"
        helperText="Space-separated list of users"
        onChange={e => setUsers(e.target.value)}
        value={users}
      />
      <SubmitButton loading={loading} text="Device remove" />
    </Box>
  )
}

export const DeviceListForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [ids, setIds] = useState('')
  const [users, setUsers] = useState('')
  const [topics, setTopics] = useState('')
  const [providers, setProviders] = useState('')
  const [platforms, setPlatforms] = useState('')
  const [cursor, setCursor] = useState('')
  const [limit, setLimit] = useState('')
  const [includeTotalCount, setIncludeTotalCount] = useState(false)
  const [includeMeta, setIncludeMeta] = useState(false)
  const [includeTopics, setIncludeTopics] = useState(false)
  const [includeWebpushKeys, setIncludeWebpushKeys] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const filter: any = {}
    if (ids.trim()) filter.ids = splitList(ids)
    if (users.trim()) filter.users = splitList(users)
    if (topics.trim()) filter.topics = splitList(topics)
    if (providers.trim()) filter.providers = splitList(providers)
    if (platforms.trim()) filter.platforms = splitList(platforms)
    const params: any = {}
    if (Object.keys(filter).length) params.filter = filter
    if (includeTotalCount) params.include_total_count = true
    if (includeMeta) params.include_meta = true
    if (includeTopics) params.include_topics = true
    if (includeWebpushKeys) params.include_webpush_keys = true
    if (cursor.trim()) params.cursor = cursor.trim()
    if (limit.trim()) params.limit = parseInt(limit)
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Filter (all space-separated, all optional)
      </Typography>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="IDs"
            autoComplete="off"
            onChange={e => setIds(e.target.value)}
            value={ids}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Users"
            autoComplete="off"
            onChange={e => setUsers(e.target.value)}
            value={users}
          />
        </Grid>
        <Grid size={4}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
        <Grid size={4}>
          <TextField
            margin="normal"
            fullWidth
            label="Providers"
            autoComplete="off"
            onChange={e => setProviders(e.target.value)}
            value={providers}
          />
        </Grid>
        <Grid size={4}>
          <TextField
            margin="normal"
            fullWidth
            label="Platforms"
            autoComplete="off"
            onChange={e => setPlatforms(e.target.value)}
            value={platforms}
          />
        </Grid>
      </Grid>
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeTotalCount}
              onChange={e => setIncludeTotalCount(e.target.checked)}
            />
          }
          label="Total count"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeMeta}
              onChange={e => setIncludeMeta(e.target.checked)}
            />
          }
          label="Meta"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeTopics}
              onChange={e => setIncludeTopics(e.target.checked)}
            />
          }
          label="Topics"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeWebpushKeys}
              onChange={e => setIncludeWebpushKeys(e.target.checked)}
            />
          }
          label="WebPush keys"
        />
      </FormGroup>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Cursor"
            autoComplete="off"
            onChange={e => setCursor(e.target.value)}
            value={cursor}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Limit"
            type="number"
            autoComplete="off"
            onChange={e => setLimit(e.target.value)}
            value={limit}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="Device list" />
    </Box>
  )
}

export const DeviceTopicListForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [deviceIds, setDeviceIds] = useState('')
  const [deviceProviders, setDeviceProviders] = useState('')
  const [devicePlatforms, setDevicePlatforms] = useState('')
  const [deviceUsers, setDeviceUsers] = useState('')
  const [topics, setTopics] = useState('')
  const [topicPrefix, setTopicPrefix] = useState('')
  const [cursor, setCursor] = useState('')
  const [limit, setLimit] = useState('')
  const [includeTotalCount, setIncludeTotalCount] = useState(false)
  const [includeDevice, setIncludeDevice] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const filter: any = {}
    if (deviceIds.trim()) filter.device_ids = splitList(deviceIds)
    if (deviceProviders.trim())
      filter.device_providers = splitList(deviceProviders)
    if (devicePlatforms.trim())
      filter.device_platforms = splitList(devicePlatforms)
    if (deviceUsers.trim()) filter.device_users = splitList(deviceUsers)
    if (topics.trim()) filter.topics = splitList(topics)
    if (topicPrefix.trim()) filter.topic_prefix = topicPrefix.trim()
    const params: any = {}
    if (Object.keys(filter).length) params.filter = filter
    if (includeTotalCount) params.include_total_count = true
    if (includeDevice) params.include_device = true
    if (cursor.trim()) params.cursor = cursor.trim()
    if (limit.trim()) params.limit = parseInt(limit)
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Filter (space-separated lists, all optional)
      </Typography>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Device IDs"
            autoComplete="off"
            onChange={e => setDeviceIds(e.target.value)}
            value={deviceIds}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Device users"
            autoComplete="off"
            onChange={e => setDeviceUsers(e.target.value)}
            value={deviceUsers}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Device providers"
            autoComplete="off"
            onChange={e => setDeviceProviders(e.target.value)}
            value={deviceProviders}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Device platforms"
            autoComplete="off"
            onChange={e => setDevicePlatforms(e.target.value)}
            value={devicePlatforms}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Topic prefix"
            autoComplete="off"
            onChange={e => setTopicPrefix(e.target.value)}
            value={topicPrefix}
          />
        </Grid>
      </Grid>
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeTotalCount}
              onChange={e => setIncludeTotalCount(e.target.checked)}
            />
          }
          label="Total count"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeDevice}
              onChange={e => setIncludeDevice(e.target.checked)}
            />
          }
          label="Device"
        />
      </FormGroup>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Cursor"
            autoComplete="off"
            onChange={e => setCursor(e.target.value)}
            value={cursor}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Limit"
            type="number"
            autoComplete="off"
            onChange={e => setLimit(e.target.value)}
            value={limit}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="Device topic list" />
    </Box>
  )
}

export const DeviceTopicUpdateForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [deviceId, setDeviceId] = useState('')
  const [op, setOp] = useState('add')
  const [topics, setTopics] = useState('')
  const [user, setUser] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { device_id: deviceId, op, topics: splitList(topics) }
    if (user.trim()) params.user = user.trim()
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Device ID"
        autoComplete="off"
        onChange={e => setDeviceId(e.target.value)}
        value={deviceId}
      />
      <Grid container spacing={2}>
        <Grid size={4}>
          <TextField
            select
            margin="normal"
            fullWidth
            label="Op"
            value={op}
            onChange={e => setOp(e.target.value)}
          >
            <MenuItem value="add">add</MenuItem>
            <MenuItem value="remove">remove</MenuItem>
            <MenuItem value="set">set</MenuItem>
          </TextField>
        </Grid>
        <Grid size={8}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            helperText="Space-separated"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
      </Grid>
      <TextField
        margin="normal"
        fullWidth
        label="User"
        autoComplete="off"
        helperText="Optional ownership guard: apply only if the device belongs to this user"
        onChange={e => setUser(e.target.value)}
        value={user}
      />
      <SubmitButton loading={loading} text="Device topic update" />
    </Box>
  )
}

export const UserTopicListForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [users, setUsers] = useState('')
  const [topics, setTopics] = useState('')
  const [topicPrefix, setTopicPrefix] = useState('')
  const [cursor, setCursor] = useState('')
  const [limit, setLimit] = useState('')
  const [includeTotalCount, setIncludeTotalCount] = useState(false)

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const filter: any = {}
    if (users.trim()) filter.users = splitList(users)
    if (topics.trim()) filter.topics = splitList(topics)
    if (topicPrefix.trim()) filter.topic_prefix = topicPrefix.trim()
    const params: any = {}
    if (Object.keys(filter).length) params.filter = filter
    if (includeTotalCount) params.include_total_count = true
    if (cursor.trim()) params.cursor = cursor.trim()
    if (limit.trim()) params.limit = parseInt(limit)
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Filter (space-separated lists, all optional)
      </Typography>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Users"
            autoComplete="off"
            onChange={e => setUsers(e.target.value)}
            value={users}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Topic prefix"
            autoComplete="off"
            onChange={e => setTopicPrefix(e.target.value)}
            value={topicPrefix}
          />
        </Grid>
      </Grid>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeTotalCount}
              onChange={e => setIncludeTotalCount(e.target.checked)}
            />
          }
          label="Total count"
        />
      </FormGroup>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Cursor"
            autoComplete="off"
            onChange={e => setCursor(e.target.value)}
            value={cursor}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Limit"
            type="number"
            autoComplete="off"
            onChange={e => setLimit(e.target.value)}
            value={limit}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="User topic list" />
    </Box>
  )
}

export const UserTopicUpdateForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [user, setUser] = useState('')
  const [op, setOp] = useState('add')
  const [topics, setTopics] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ user, op, topics: splitList(topics) })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="User"
        autoComplete="off"
        onChange={e => setUser(e.target.value)}
        value={user}
      />
      <Grid container spacing={2}>
        <Grid size={4}>
          <TextField
            select
            margin="normal"
            fullWidth
            label="Op"
            value={op}
            onChange={e => setOp(e.target.value)}
          >
            <MenuItem value="add">add</MenuItem>
            <MenuItem value="remove">remove</MenuItem>
            <MenuItem value="set">set</MenuItem>
          </TextField>
        </Grid>
        <Grid size={8}>
          <TextField
            margin="normal"
            fullWidth
            label="Topics"
            autoComplete="off"
            helperText="Space-separated"
            onChange={e => setTopics(e.target.value)}
            value={topics}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="User topic update" />
    </Box>
  )
}

export const SendPushNotificationForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const { showAlert } = useContext(ShellContext)
  const [recipient, setRecipient] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [uid, setUid] = useState('')
  const [sendAt, setSendAt] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!recipient || !notification) {
      showAlert('Recipient and notification required', { severity: 'error' })
      return
    }
    let recipientObj
    let notificationObj
    try {
      recipientObj = JSON.parse(recipient)
    } catch {
      showAlert('Invalid recipient JSON', { severity: 'error' })
      return
    }
    try {
      notificationObj = JSON.parse(notification)
    } catch {
      showAlert('Invalid notification JSON', { severity: 'error' })
      return
    }
    const params: any = {
      recipient: recipientObj,
      notification: notificationObj,
    }
    if (uid.trim()) params.uid = uid.trim()
    if (sendAt.trim()) params.send_at = parseInt(sendAt)
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="UID"
            autoComplete="off"
            helperText="Optional; used to cancel the push later"
            onChange={e => setUid(e.target.value)}
            value={uid}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Send at"
            type="number"
            autoComplete="off"
            helperText="Unix seconds; empty = send immediately"
            onChange={e => setSendAt(e.target.value)}
            value={sendAt}
          />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary">
        Recipient (JSON, e.g. {'{ "filter": { "users": ["42"] } }'})
      </Typography>
      <Box sx={{ mt: 1, mb: 2 }}>
        <JsonField colorMode={colorMode} onChange={setRecipient} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        Notification (JSON, e.g. {'{ "fcm": { "message": { ... } } }'})
      </Typography>
      <Box sx={{ mt: 1 }}>
        <JsonField colorMode={colorMode} onChange={setNotification} />
      </Box>
      <SubmitButton loading={loading} text="Send push notification" />
    </Box>
  )
}

export const UpdatePushStatusForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [analyticsUid, setAnalyticsUid] = useState('')
  const [status, setStatus] = useState('delivered')
  const [deviceId, setDeviceId] = useState('')
  const [msgId, setMsgId] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params: any = { analytics_uid: analyticsUid, status }
    if (deviceId.trim()) params.device_id = deviceId.trim()
    if (msgId.trim()) params.msg_id = msgId.trim()
    sendRequest(params)
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="Analytics UID"
        autoComplete="off"
        helperText="Should match SendPushNotification analytics_uid (or uid)"
        onChange={e => setAnalyticsUid(e.target.value)}
        value={analyticsUid}
      />
      <TextField
        select
        margin="normal"
        fullWidth
        label="Status"
        value={status}
        onChange={e => setStatus(e.target.value)}
      >
        <MenuItem value="delivered">delivered</MenuItem>
        <MenuItem value="interacted">interacted</MenuItem>
      </TextField>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Device ID"
            autoComplete="off"
            onChange={e => setDeviceId(e.target.value)}
            value={deviceId}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            margin="normal"
            fullWidth
            label="Message ID"
            autoComplete="off"
            helperText="Provider-issued message id"
            onChange={e => setMsgId(e.target.value)}
            value={msgId}
          />
        </Grid>
      </Grid>
      <SubmitButton loading={loading} text="Update push status" />
    </Box>
  )
}

export const CancelPushForm = ({
  colorMode,
  loading,
  sendRequest,
}: FormProps) => {
  const [uid, setUid] = useState('')

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendRequest({ uid })
  }

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 0 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        label="UID"
        autoComplete="off"
        helperText="The uid used when the push was sent"
        onChange={e => setUid(e.target.value)}
        value={uid}
      />
      <SubmitButton loading={loading} text="Cancel push" />
    </Box>
  )
}
